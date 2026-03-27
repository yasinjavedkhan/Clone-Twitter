const fs = require('fs');
const path = require('path');

// Basic .env.local parser
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('.env.local not found');
        return {};
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            env[match[1]] = value;
        }
    });
    return env;
}

const env = loadEnv();
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}

const db = admin.firestore();

async function checkTokens() {
    console.log('--- USER FCM STATUS ---');
    try {
        const snap = await db.collection('users').get();
        if (snap.empty) {
            console.log('No users found in Firestore.');
            return;
        }
        snap.forEach(doc => {
            const data = doc.data();
            console.log(`User: ${doc.id} | Name: ${data.displayName || 'N/A'} | Has Token: ${!!data.fcmToken}`);
            if (data.fcmToken) {
                console.log(`  -> Token (Partial): ${data.fcmToken.substring(0, 15)}...`);
            }
        });
    } catch (err) {
        console.error('Firestore Error:', err);
    }
}

checkTokens().then(() => process.exit(0));
