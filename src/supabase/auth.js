import { supabase } from './client';
import { verifyCredentials } from '../data/credentials';

export const registerUser = async () => {
  throw new Error('Public registration is closed. Please sign in using your assigned Competition ID.');
};

export const loginWithMudraCredentials = async (identifier, password) => {
  const verified = verifyCredentials(identifier, password);
  if (!verified) {
    throw new Error('Access Denied. Only authorized credentials (MUDRA001–MUDRA200, TRIAL001–TRIAL050, or Admin) are permitted.');
  }

  const { email, password: cleanPassword, name, participantId, role, cash } = verified;

  // 1. Try Signing In
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: cleanPassword,
  });

  if (signInData?.user) {
    // User already exists, ensure role and cash are synchronized if admin
    if (role === 'admin') {
      await supabase
        .from('profiles')
        .update({ role: 'admin', cash: 99900000000 })
        .eq('id', signInData.user.id);
    }
    return signInData.user;
  }

  // 2. If Sign In failed because user is not yet created in Supabase Auth, auto-provision
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: cleanPassword,
    options: {
      data: {
        name,
        participant_id: participantId,
      },
    },
  });

  if (signUpError) throw signUpError;

  const newUser = signUpData.user;
  if (newUser) {
    await supabase.from('profiles').upsert({
      id: newUser.id,
      name,
      email,
      participant_id: participantId,
      cash: cash || 200000.0,
      role: role || 'student',
    });
  }

  return newUser;
};

export const loginUser = async (email, password) => {
  return loginWithMudraCredentials(email, password);
};

export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getUserData = async (uid) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  if (error || !data) {
    // Attempt auto-healing: if auth user exists but profile row is missing, insert it
    const { data: authUser } = await supabase.auth.getUser();
    if (authUser?.user && authUser.user.id === uid) {
      const newProfile = {
        id: uid,
        name: authUser.user.user_metadata?.name || authUser.user.email?.split('@')[0] || 'Trader',
        email: authUser.user.email || '',
        participant_id: authUser.user.user_metadata?.participant_id || '',
        cash: 200000.0,
        role: 'student',
      };
      await supabase.from('profiles').upsert(newProfile);
      return {
        uid,
        name: newProfile.name,
        email: newProfile.email,
        participantId: newProfile.participant_id,
        cash: 200000.0,
        role: 'student',
      };
    }
    return null;
  }

  const isGodAdmin =
    data.role === 'admin' ||
    ['adarsh@mudra.internal', 'swastik@mudra.internal', 'harsha@mudra.internal'].includes(data.email) ||
    ['adarshgod', 'swastikgod', 'harshagodess'].includes(data.participant_id);

  return {
    uid: data.id,
    name: data.name,
    email: data.email,
    participantId: data.participant_id,
    cash: isGodAdmin ? 99900000000 : Number(data.cash || 0),
    role: isGodAdmin ? 'admin' : (data.role || 'student'),
    joinedAt: data.created_at,
  };
};
