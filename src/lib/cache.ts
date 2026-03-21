import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

class UserCache {
  private cache: Record<string, any> = {};
  private pending: Record<string, Promise<any>> = {};

  async fetchUser(uid: string) {
    if (this.cache[uid] !== undefined) return this.cache[uid];
    if (this.pending[uid] !== undefined) return this.pending[uid];

    this.pending[uid] = (async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          this.cache[uid] = userDoc.data();
          return this.cache[uid];
        }
        return null;
      } catch (error) {
        console.error(`Error fetching user ${uid}:`, error);
        return null;
      } finally {
        delete this.pending[uid];
      }
    })();

    return this.pending[uid];
  }

  get(uid: string) {
    return this.cache[uid];
  }

  set(uid: string, data: any) {
    this.cache[uid] = data;
  }
}

export const userCache = new UserCache();
