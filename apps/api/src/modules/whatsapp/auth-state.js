import { BufferJSON, initAuthCreds, proto } from "@whiskeysockets/baileys";
import { WaAuthKeyModel } from "@rasoipulse/db";
import { decryptSecret, encryptSecret } from "../../lib/crypto.js";
import { logger } from "../../logger.js";

/**
 * A linked number's session, kept in the database instead of a folder on one server's disk, ENCRYPTED: whoever
 * holds these keys can read and send as that WhatsApp number. Reads are served from memory after the first one
 * (Baileys asks for the same keys constantly); every write goes to the database.
 */
export async function useMongoAuthState({ brandId, accountId }) {
  const filter = (key) => ({ brandId, accountId, key });
  const memory = new Map();

  const read = async (key) => {
    if (memory.has(key)) return memory.get(key);
    const doc = await WaAuthKeyModel.findOne(filter(key)).lean();
    let value = null;
    if (doc) {
      try {
        value = JSON.parse(decryptSecret(doc.value), BufferJSON.reviver);
      } catch (err) {
        logger.error({ err: err.message, accountId, key }, "whatsapp: a session key can't be read (ENCRYPTION_KEY changed?)");
      }
    }
    memory.set(key, value);
    return value;
  };
  const write = async (key, value) => {
    memory.set(key, value);
    const enc = encryptSecret(JSON.stringify(value, BufferJSON.replacer));
    await WaAuthKeyModel.updateOne(filter(key), { $set: { value: enc } }, { upsert: true });
  };
  const remove = async (key) => {
    memory.delete(key);
    await WaAuthKeyModel.deleteOne(filter(key));
  };

  const creds = (await read("creds")) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const out = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await read(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
              out[id] = value;
            }),
          );
          return out;
        },
        set: async (data) => {
          const tasks = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              tasks.push(value ? write(`${category}-${id}`, value) : remove(`${category}-${id}`));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => write("creds", creds),
  };
}

/** Forget a number's session entirely (unlinked). */
export async function clearAuthState({ brandId, accountId }) {
  await WaAuthKeyModel.deleteMany({ brandId, accountId });
}
