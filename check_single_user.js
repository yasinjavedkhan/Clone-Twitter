
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, limit } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyDOOlKD6kaX92b805M73jz9Ceodagffqj0",
    authDomain: "twitter-clone-app-16eb3.firebaseapp.com",
    projectId: "twitter-clone-app-16eb3",
    storageBucket: "twitter-clone-app-16eb3.firebasestorage.app",
    messagingSenderId: "249903575848",
    appId: "1:249903575848:web:9d1f7443118293a6cf161d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSingleUser() {
    try {
        const snapshot = await getDocs(query(collection(db, "users"), limit(1)));
        if (!snapshot.empty) {
            console.log(JSON.stringify(snapshot.docs[0].data(), null, 2));
        } else {
            console.log("No users found.");
        }
    } catch (e) {
        console.error(e);
    }
}
checkSingleUser();
