import Learner from '../models/LearnerSchema.models.js';

export async function generateAdmissionNumber() {
  // Define the static part and the current year
  const patternPart = 'ADM';
  const currentYear = new Date().getFullYear().toString(); // e.g., "2025"

  // Find the latest Learner for the current year
  const latestLearner = await Learner.findOne({
    admissionNumber: { $regex: `^${patternPart}${currentYear}` },
  }).sort({ admissionNumber: -1 });

  let serialNumber = 1;
  if (latestLearner) {
    // Extract the last two digits (incrementing part)
    const latestSerial = parseInt(latestLearner.admissionNumber.slice(-2), 10);
    serialNumber = latestSerial + 1;
  }

  // Ensure two-digit serial number (01, 02, ..., 99)
  const formattedSerial = serialNumber.toString().padStart(2, '0');

  // Generate the final admission number
  const admissionNumber = `${patternPart}${currentYear}${formattedSerial}`;

  return admissionNumber;
}
