import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Real-time Firestore listener for the `parties` collection.
 * Returns an array of party documents sorted by createdAt descending.
 */
export function useParties() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "parties"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setParties(data);
        setLoading(false);
      },
      (err) => {
        console.error("useParties error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { parties, loading, error };
}
