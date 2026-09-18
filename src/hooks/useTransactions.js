import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Real-time listener for users/{uid}/transactions, sorted by transactionDate desc.
 * @param {string|null} uid
 */
export function useTransactions(uid) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!uid) { setTransactions([]); setLoading(false); return; }

    const q = query(
      collection(db, "users", uid, "transactions"),
      orderBy("transactionDate", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { console.error("useTransactions:", err); setError(err.message); setLoading(false); }
    );

    return unsub;
  }, [uid]);

  return { transactions, loading, error };
}
