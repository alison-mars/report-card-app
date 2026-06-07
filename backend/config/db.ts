import dotenv from "dotenv";
dotenv.config()
import mongoose from "mongoose";

async function repairStaleUserIndexes() {
    try {
        const users = mongoose.connection.collection("users");
        const indexes = await users.indexes();
        const stalePhoneIndexes = indexes.filter((index) => {
            const keys = Object.keys(index.key || {});
            return keys.length === 1 && keys[0] === "phone";
        });

        for (const index of stalePhoneIndexes) {
            if (!index.name) continue;
            console.log(`Dropping stale users index: ${index.name}`);
            await users.dropIndex(index.name);
        }
    } catch (error: any) {
        // NamespaceNotFound means the users collection does not exist yet.
        if (error?.codeName === "NamespaceNotFound") return;
        console.error("Failed to repair stale user indexes:", error);
    }
}

function connectDatabse() {
    mongoose.connect(process.env.DB_URL || "").then(
        async () => {
            console.log("connected succesfully");
            await repairStaleUserIndexes();
        }
    ).catch(err => {
        console.log(err);
    });
}

export default connectDatabse;