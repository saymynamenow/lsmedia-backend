import cron from "node-cron";
import prisma from "../config/prismaConfig.js";

// Helper function to update expired sponsored posts
export async function updateExpiredPosts() {
  try {
    const now = new Date();

    const updatedPosts = await prisma.sponsored.updateMany({
      where: {
        endDate: {
          lt: now, // Less than current date/time
        },
        isActive: {
          in: ["accepted", "pending"], // Only update accepted or pending posts
        },
      },
      data: {
        isActive: "expired",
      },
    });

    console.log(
      `[${new Date().toISOString()}] Updated ${
        updatedPosts.count
      } expired sponsored posts`
    );
    return updatedPosts.count;
  } catch (error) {
    console.error("Error updating expired posts:", error);
    return 0;
  }
}

// Cron job to run every hour
const startSponsoredScheduler = () => {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    console.log("Running sponsored posts expiration check...");
    await updateExpiredPosts();
  });

  console.log("Sponsored posts scheduler started - running every hour");
};

export default startSponsoredScheduler;
