
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

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

async function checkTweets() {
    try {
        const snapshot = await getDocs(collection(db, "tweets"));
        console.log(`Total tweets found: ${snapshot.size}`);
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`- Tweet: ${data.content} (Author: ${data.authorName})`);
        });
    } catch (e) {
        console.error(e);
    }
}
checkTweets();
