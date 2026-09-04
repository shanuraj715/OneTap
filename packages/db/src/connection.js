import mongoose from "mongoose";

                                   
              
                  
 

let pending                                  = null;

/** Connect once. Safe to call repeatedly; returns the live connection. */
export async function connectDb(opts                  )                           {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (pending) return pending;

  mongoose.set("strictQuery", true);
  pending = mongoose
    .connect(opts.uri, {
      dbName: opts.dbName,
      serverSelectionTimeoutMS: 5000,
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export async function disconnectDb()                {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

;                                                                                   

const STATE_NAMES                          = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function dbState()          {
  return STATE_NAMES[mongoose.connection.readyState] ?? "disconnected";
}

export { mongoose };
