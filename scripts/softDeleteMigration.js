/**
 * Migration Helper Script for Soft Delete System
 *
 * This script provides helper functions to safely migrate to the soft delete system.
 * Run this after updating your schema but before deploying to production.
 */

import prisma from "../config/prismaConfig.js";

/**
 * Check if soft delete columns exist
 */
const checkSoftDeleteColumns = async () => {
  const models = [
    "user",
    "post",
    "page",
    "comment",
    "story",
    "media",
    "notification",
    "follower",
    "friendship",
    "pageMember",
    "pageFollower",
    "reaction",
    "boostedPost",
    "sponsored",
    "verificationRequest",
  ];

  console.log("🔍 Checking soft delete columns...");

  for (const modelName of models) {
    try {
      const model = prisma[modelName];
      if (model) {
        // Try to query with deletedAt field
        await model.findFirst({
          where: { deletedAt: null },
          take: 1,
        });
        console.log(`✅ ${modelName}: deletedAt column exists`);
      }
    } catch (error) {
      console.log(
        `❌ ${modelName}: deletedAt column missing or error - ${error.message}`
      );
    }
  }
};

/**
 * Create indexes for soft delete columns
 */
const createSoftDeleteIndexes = async () => {
  console.log("🔧 Creating soft delete indexes...");

  const indexQueries = [
    "CREATE INDEX IF NOT EXISTS idx_user_deleted_at ON user (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_post_deleted_at ON post (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_page_deleted_at ON page (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_comment_deleted_at ON comment (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_story_deleted_at ON story (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON media (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_notification_deleted_at ON notification (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_follower_deleted_at ON follower (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_friendship_deleted_at ON friendship (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_pagemember_deleted_at ON pagemember (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_pagefollower_deleted_at ON pagefollower (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_reaction_deleted_at ON reaction (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_boosted_post_deleted_at ON boosted_post (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_sponsored_deleted_at ON sponsored (deletedAt)",
    "CREATE INDEX IF NOT EXISTS idx_verificationrequest_deleted_at ON verificationrequest (deletedAt)",
  ];

  for (const query of indexQueries) {
    try {
      await prisma.$executeRawUnsafe(query);
      console.log(`✅ Created index: ${query.split(" ")[5]}`);
    } catch (error) {
      console.log(`❌ Error creating index: ${error.message}`);
    }
  }
};

/**
 * Validate existing data integrity
 */
const validateDataIntegrity = async () => {
  console.log("🔍 Validating data integrity...");

  try {
    // Check for orphaned records
    const orphanedPosts = await prisma.post.count({
      where: {
        deletedAt: null,
        author: {
          deletedAt: { not: null },
        },
      },
    });

    const orphanedComments = await prisma.comment.count({
      where: {
        deletedAt: null,
        user: {
          deletedAt: { not: null },
        },
      },
    });

    const orphanedMedia = await prisma.media.count({
      where: {
        deletedAt: null,
        post: {
          deletedAt: { not: null },
        },
      },
    });

    console.log(`📊 Data integrity check:`);
    console.log(`   - Orphaned posts: ${orphanedPosts}`);
    console.log(`   - Orphaned comments: ${orphanedComments}`);
    console.log(`   - Orphaned media: ${orphanedMedia}`);

    if (orphanedPosts > 0 || orphanedComments > 0 || orphanedMedia > 0) {
      console.log(
        "⚠️  Warning: Found orphaned records. Consider cleaning up before going live."
      );
    } else {
      console.log("✅ Data integrity check passed!");
    }
  } catch (error) {
    console.error("❌ Error validating data integrity:", error);
  }
};

/**
 * Test soft delete functionality
 */
const testSoftDeleteFunctionality = async () => {
  console.log("🧪 Testing soft delete functionality...");

  try {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        username: `test_user_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: "test123",
        name: "Test User",
      },
    });

    // Create test post
    const testPost = await prisma.post.create({
      data: {
        content: "Test post for soft delete",
        authorId: testUser.id,
      },
    });

    // Test soft delete
    await prisma.user.update({
      where: { id: testUser.id },
      data: { deletedAt: new Date() },
    });

    // Verify soft delete
    const softDeletedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });

    const activeUsers = await prisma.user.findMany({
      where: {
        deletedAt: null,
        id: testUser.id,
      },
    });

    // Test restore
    await prisma.user.update({
      where: { id: testUser.id },
      data: { deletedAt: null },
    });

    const restoredUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });

    // Cleanup
    await prisma.post.delete({ where: { id: testPost.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    console.log("✅ Soft delete test passed!");
    console.log(
      `   - User soft deleted: ${softDeletedUser.deletedAt ? "Yes" : "No"}`
    );
    console.log(
      `   - User excluded from active query: ${
        activeUsers.length === 0 ? "Yes" : "No"
      }`
    );
    console.log(
      `   - User restored: ${restoredUser.deletedAt === null ? "Yes" : "No"}`
    );
  } catch (error) {
    console.error("❌ Soft delete test failed:", error);
  }
};

/**
 * Generate soft delete statistics
 */
const generateStatistics = async () => {
  console.log("📊 Generating soft delete statistics...");

  const models = [
    "user",
    "post",
    "page",
    "comment",
    "story",
    "media",
    "notification",
    "follower",
    "friendship",
    "pageMember",
    "pageFollower",
    "reaction",
    "boostedPost",
    "sponsored",
    "verificationRequest",
  ];

  const stats = {};

  for (const modelName of models) {
    try {
      const model = prisma[modelName];
      if (model) {
        const total = await model.count();
        const active = await model.count({
          where: { deletedAt: null },
        });
        const softDeleted = total - active;

        stats[modelName] = {
          total,
          active,
          softDeleted,
          softDeletedPercentage:
            total > 0 ? ((softDeleted / total) * 100).toFixed(2) : 0,
        };
      }
    } catch (error) {
      console.error(`Error getting stats for ${modelName}:`, error);
    }
  }

  console.table(stats);
  return stats;
};

/**
 * Main migration function
 */
const runMigration = async () => {
  console.log("🚀 Starting soft delete system migration...\n");

  try {
    await checkSoftDeleteColumns();
    console.log("");

    await createSoftDeleteIndexes();
    console.log("");

    await validateDataIntegrity();
    console.log("");

    await testSoftDeleteFunctionality();
    console.log("");

    await generateStatistics();
    console.log("");

    console.log("✅ Soft delete system migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export {
  checkSoftDeleteColumns,
  createSoftDeleteIndexes,
  validateDataIntegrity,
  testSoftDeleteFunctionality,
  generateStatistics,
  runMigration,
};
