import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Real-time listener for users/{uid}/parties, sorted by createdAt desc.
 * @param {string|null} uid
 */
export function useParties(uid) {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!uid) { setParties([]); setLoading(false); return; }

    const q = query(
      collection(db, "users", uid, "parties"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setParties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { console.error("useParties:", err); setError(err.message); setLoading(false); }
    );

    return unsub;
  }, [uid]);

  return { parties, loading, error };
}
