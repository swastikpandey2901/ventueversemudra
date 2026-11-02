import {
  doc, collection, getDocs, getDoc, setDoc, updateDoc,
  addDoc, query, orderBy, limit, onSnapshot, serverTimestamp,
  where, writeBatch, increment,
} from 'firebase/firestore';
import { db } from './config';

// ─── Stocks ───────────────────────────────────────────────────────────────────
export const getStock = async (ticker) => {
  const snap = await getDoc(doc(db, 'stocks', ticker));
  return snap.exists() ? snap.data() : null;
};

export const getAllStocks = async () => {
  const snap = await getDocs(collection(db, 'stocks'));
  return snap.docs.map(d => d.data());
};

export const subscribeStocks = (callback) => {
  return onSnapshot(collection(db, 'stocks'), (snap) => {
    callback(snap.docs.map(d => d.data()));
  });
};

export const subscribeStock = (ticker, callback) => {
  return onSnapshot(doc(db, 'stocks', ticker), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
};

// ─── Trades ───────────────────────────────────────────────────────────────────
export const placeTrade = async ({ userId, userName, ticker, type, quantity, price }) => {
  const totalValue = quantity * price;
  const userRef = doc(db, 'users', userId);
  const userData = (await getDoc(userRef)).data();

  if (type === 'buy') {
    if (userData.cash < totalValue) throw new Error('Insufficient Mudra Coins');
    await updateDoc(userRef, { cash: userData.cash - totalValue });
  } else {
    // sell — verify holdings
    const holdingRef = doc(db, 'users', userId, 'holdings', ticker);
    const holdingSnap = await getDoc(holdingRef);
    if (!holdingSnap.exists() || holdingSnap.data().quantity < quantity) {
      throw new Error('Insufficient shares to sell');
    }
    await updateDoc(userRef, { cash: userData.cash + totalValue });
  }

  // update holding
  const holdingRef = doc(db, 'users', userId, 'holdings', ticker);
  const holdingSnap = await getDoc(holdingRef);
  if (type === 'buy') {
    if (holdingSnap.exists()) {
      const h = holdingSnap.data();
      const newQty = h.quantity + quantity;
      const newAvg = ((h.avgPrice * h.quantity) + totalValue) / newQty;
      await setDoc(holdingRef, { ticker, quantity: newQty, avgPrice: newAvg });
    } else {
      await setDoc(holdingRef, { ticker, quantity, avgPrice: price });
    }
  } else {
    const newQty = holdingSnap.data().quantity - quantity;
    if (newQty <= 0) {
      await setDoc(holdingRef, { ticker, quantity: 0, avgPrice: 0 });
    } else {
      await updateDoc(holdingRef, { quantity: newQty });
    }
  }

  // record trade
  await addDoc(collection(db, 'trades'), {
    userId, userName, ticker, type, quantity, price,
    totalValue, timestamp: serverTimestamp(),
  });

  // record pending volume for price engine
  const volRef = doc(db, 'pendingVolume', ticker);
  const volSnap = await getDoc(volRef);
  const existing = volSnap.exists() ? volSnap.data() : { buyVolume: 0, sellVolume: 0 };
  await setDoc(volRef, {
    ticker,
    buyVolume: type === 'buy' ? existing.buyVolume + totalValue : existing.buyVolume,
    sellVolume: type === 'sell' ? existing.sellVolume + totalValue : existing.sellVolume,
  });
};

// ─── Holdings ────────────────────────────────────────────────────────────────
export const getUserHoldings = async (userId) => {
  const snap = await getDocs(collection(db, 'users', userId, 'holdings'));
  return snap.docs.map(d => d.data()).filter(h => h.quantity > 0);
};

export const subscribeHoldings = (userId, callback) => {
  return onSnapshot(collection(db, 'users', userId, 'holdings'), (snap) => {
    callback(snap.docs.map(d => d.data()).filter(h => h.quantity > 0));
  });
};

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export const subscribeLeaderboard = (callback) => {
  const q = query(collection(db, 'leaderboard'), orderBy('totalValue', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d, i) => ({ ...d.data(), rank: i + 1 })));
  });
};

// ─── News ─────────────────────────────────────────────────────────────────────
export const subscribeNews = (callback) => {
  const q = query(collection(db, 'news'), orderBy('publishedAt', 'desc'), limit(20));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const publishNews = async (newsData) => {
  return addDoc(collection(db, 'news'), {
    ...newsData,
    publishedAt: serverTimestamp(),
    status: 'pending',
  });
};

// ─── Event ────────────────────────────────────────────────────────────────────
export const subscribeEvent = (callback) => {
  return onSnapshot(doc(db, 'event', 'main'), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
};

// ─── Admin: recent trades ─────────────────────────────────────────────────────
export const subscribeRecentTrades = (callback) => {
  const q = query(collection(db, 'trades'), orderBy('timestamp', 'desc'), limit(30));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

// ─── Admin: all users ─────────────────────────────────────────────────────────
export const getAllUsers = async () => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
};
