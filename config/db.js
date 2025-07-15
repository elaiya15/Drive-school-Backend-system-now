// import mongoose from "mongoose";
// import dotenv from "dotenv";
// dotenv.config();

// // MongoDB Connection
// mongoose.connect(process.env.MONGO_URI, {
//   // useNewUrlParser: true,
//   // useUnifiedTopology: true,
// });

// const DbConnection = mongoose.connection;

// // Error Event
// DbConnection.on("error", (error) => {
//   console.log(`Error: connecting to Mongoose database ${error}`);
// });

// // Success Event
// // DbConnection.once("open", () => {
// //   console.log("Database connected successfully"); // ✅ This will print now
// // });

// export default DbConnection;req.accepts(types);




import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let isConnected = false; // Track connection state across function calls

export const connectToDatabase = async () => {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "drivingSchoolDB", // optional but recommended
      serverSelectionTimeoutMS: 80000, // longer timeout to avoid Vercel cold start issues
    });

    isConnected = true;

    mongoose.connection.on("connected", () => {
      console.log("✅ Connected to MongoDB");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error.message);
    throw error;
  }
};
