import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Real-time Firestore listener for the `transactions` collection.
 * Returns an array of transaction documents sorted by transactionDate descending.
 */
export function useTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "transactions"),
      orderBy("transactionDate", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTransactions(data);
        setLoading(false);
      },
      (err) => {
        console.error("useTransactions error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { transactions, loading, error };
}
