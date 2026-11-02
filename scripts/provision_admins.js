import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

const admins = [
  { username: 'adarshgod', pass: 'kahish@1503', name: 'Adarsh (God Admin)' },
  { username: 'swastikgod', pass: 'sneha@1429', name: 'Swastik (God Admin)' },
  { username: 'harshagodess', pass: 'papa@maa@2627', name: 'Harsha (God Admin)' }
];

async function setupAdmins() {
  for (const a of admins) {
    const email = a.username + '@mudra.internal';
    console.log('Processing admin:', a.username);
    let user = null;
    const { data: sData } = await supabase.auth.signInWithPassword({ email, password: a.pass });
    if (sData?.user) {
      user = sData.user;
      console.log('Admin already exists:', a.username);
    } else {
      const { data: uData, error } = await supabase.auth.signUp({
        email,
        password: a.pass,
        options: { data: { name: a.name, participant_id: a.username } }
      });
      if (error) {
        console.error('Sign up error for', a.username, error.message);
      } else {
        user = uData.user;
        console.log('Created auth user for:', a.username);
      }
    }

    if (user) {
      const { error: pErr } = await supabase.from('profiles').upsert({
        id: user.id,
        name: a.name,
        email,
        participant_id: a.username,
        cash: 99900000000,
        role: 'admin'
      });
      console.log('Upserted admin profile for', a.username, pErr ? pErr.message : 'SUCCESS');
    }
  }
  process.exit(0);
}

setupAdmins();
