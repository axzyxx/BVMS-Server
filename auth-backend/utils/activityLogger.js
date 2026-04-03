import Activity from "../models/Activity.js";

/**
 * Log an admin activity
 * @param {string} type - Activity type (resident_added, official_added, etc.)
 * @param {string} title - Activity title
 * @param {string} description - Activity description
 * @param {object} metadata - Additional metadata
 */
export const logActivity = async (type, title, description = "", metadata = {}) => {
  try {
    const activity = new Activity({
      type,
      title,
      description,
      metadata,
    });
    await activity.save();
  } catch (err) {
    console.error("Error logging activity:", err);
    // Don't throw - activity logging should not break the main flow
  }
};

