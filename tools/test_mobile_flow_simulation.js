const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== SIMULATING MOBILE CLIENT ROUTING & REGISTRATION FLOW ===\n');

  // Simulated LocalStorage
  const storage = {};
  const setItem = (k, v) => { storage[k] = String(v); };
  const getItem = (k) => storage[k] || null;
  const removeItem = (k) => { delete storage[k]; };

  const ts = Date.now();
  const testEmail = `candidate.sim.${ts}@circle.io`;
  const testPhone = `+1555${ts % 10000000}`;
  const testName = `Candidate Sim ${ts % 1000}`;

  // Step 1: Initial state
  let appView = 'welcome';
  console.log('1. Initial screen: appView =', appView);

  // Step 2 & 3: Requester submits access request
  console.log('2. User taps "Join the circle", then "Request invitation"');
  appView = 'invitation';
  setItem('app_view', appView);
  
  const reqRes = await post('/api/invitations/request-access', {
    email: testEmail,
    fullName: testName,
    role: 'Partner, Private Equity',
    phone: testPhone,
  });
  console.log('   Access request submitted:', reqRes.status === 200 ? 'SUCCESS' : 'FAILED');

  // Step 4 & 5: Admin approves request as Paid
  console.log('3. Admin reviews and approves as Paid membership');
  const apprRes = await post('/api/admin/invitations/review/decision', {
    email: testEmail,
    action: 'approve',
    membership_tier: 'paid',
    adminEmail: 'ermolov.elena@gmail.com',
  });
  const token = apprRes.data.token;
  console.log('   Official invite token generated:', token);

  // Step 6: User enters & validates token
  console.log('4. User inserts invite token into mobile app');
  const verifyInvite = await post('/api/invitations/verify', { token });
  if (!verifyInvite.data.valid) throw new Error('Token verification failed');

  setItem('invitation_code', token);
  setItem('invitation_email', testEmail);
  setItem('auth_mode', 'new_member');
  appView = 'phone_auth';
  setItem('app_view', appView);
  console.log('   Token validated! appView transitioned to:', appView);

  // Step 7: Verify phone number
  console.log('5. User enters phone number and submits SMS verification');
  await post('/api/auth/phone/send-code', { phone: testPhone });
  const verifyPhone = await post('/api/auth/phone/verify-code', {
    phone: testPhone,
    code: '123456',
    token: getItem('invitation_code'),
  });

  if (!verifyPhone.data.verified) throw new Error('Phone verification failed');
  console.log('   Phone verification result:', {
    verified: verifyPhone.data.verified,
    is_new_member: verifyPhone.data.is_new_member,
    onboarding_completed: verifyPhone.data.onboarding_completed,
    onboarding_step: verifyPhone.data.onboarding_step,
  });

  // Client routing logic check:
  if (verifyPhone.data.user) {
    setItem('current_user_id', verifyPhone.data.user.id);
    setItem('terms_accepted_version', '2026-10-v1');
    setItem('ozara_session_token', verifyPhone.data.token);
  }

  if (verifyPhone.data.onboarding_completed) {
    appView = 'tabs';
  } else {
    // Crucial check: incomplete onboarding MUST go to signup (questionnaire)!
    appView = 'signup';
  }
  setItem('app_view', appView);
  console.log('   CRITICAL ROUTING CHECK: appView is now:', appView);
  if (appView !== 'signup') {
    throw new Error('FAILED: Incomplete member incorrectly routed to ' + appView + ' instead of signup!');
  }

  // Step 8: SignUpScreen mount & Questionnaire
  console.log('\n6. SignUpScreen mounts');
  const hasAccount = getItem('current_user_id') && getItem('terms_accepted_version');
  let viewMode = hasAccount ? 'questionnaire_page' : 'check_token';
  console.log('   SignUpScreen viewMode is:', viewMode);
  if (viewMode !== 'questionnaire_page') {
    throw new Error('FAILED: SignUpScreen did not open in questionnaire_page!');
  }

  const userId = getItem('current_user_id');
  const sessionToken = getItem('ozara_session_token');
  const authHeaders = {
    'Authorization': `Bearer ${sessionToken}`,
    'x-user-id': userId,
  };

  // Check backend access restriction
  console.log('7. Backend gate check: Attempt to access member directory before questionnaire complete');
  const dirCheck = await get('/api/members', authHeaders);
  console.log('   Directory access status:', dirCheck.status, dirCheck.data.error || 'allowed');
  if (dirCheck.status !== 403 || dirCheck.data.error !== 'onboarding_incomplete') {
    throw new Error('FAILED: Incomplete member was not blocked by backend!');
  }

  // User answers questions midway
  console.log('8. User answers questions 2, 7, 14 midway (autosave)');
  await post(`/api/profile/${userId}/answers-bulk`, {
    userId,
    answers: [
      { question_id: 2, value: 'London, United Kingdom', visibility: 'shared' },
      { question_id: 7, value: 'General Partner', visibility: 'shared' },
      { question_id: 14, value: 'Looking for European proptech founders', visibility: 'shared' },
    ],
  });

  // SIMULATE APP RESTART / BROWSER REFRESH MIDWAY
  console.log('\n9. SIMULATING PAGE REFRESH / APP RESTART MIDWAY THROUGH QUESTIONNAIRE');
  // On reload:
  const reloadedSavedAppView = getItem('app_view');
  const reloadedSavedUser = getItem('current_user_id');
  console.log('   Restored from storage: savedAppView =', reloadedSavedAppView, ', savedUser =', reloadedSavedUser);

  // ClubContext checks onboarding status on resume
  const progressCheck = await get(`/api/onboarding/progress?userId=${userId}`, authHeaders);
  console.log('   Server onboarding progress on reload:', progressCheck.data);
  let resumedAppView = reloadedSavedAppView;
  if (!progressCheck.data.onboarding_completed && resumedAppView === 'tabs') {
    resumedAppView = 'signup';
  }
  console.log('   Resumed active view is:', resumedAppView);
  if (resumedAppView !== 'signup') {
    throw new Error('FAILED: App did not resume at signup after reload!');
  }

  // Hydrate answers on reload
  const profileHydrate = await get(`/api/profile/${userId}?viewerId=${userId}`, authHeaders);
  console.log('   Hydrated answers from database count:', profileHydrate.data.answers?.length);
  if (!profileHydrate.data.answers || profileHydrate.data.answers.length === 0) {
    throw new Error('FAILED: Questionnaire answers were not hydrated on reload!');
  }

  // Step 9: User finishes questionnaire (answers Question 18)
  console.log('\n10. User answers Question 18 ("What can you offer other members?")');
  const submitQ18 = await post(`/api/profile/${userId}/answers-bulk`, {
    userId,
    answers: [
      { question_id: 18, value: 'Mentorship on scaling fintech companies and LP introductions', visibility: 'shared' },
    ],
  });
  console.log('   Submit Q18 result:', submitQ18.data);
  if (!submitQ18.data.is_complete) throw new Error('FAILED: Profile not marked complete after Q18!');
  if (submitQ18.data.onboarding_step !== 'subscription_payment') {
    throw new Error('FAILED: Paid member onboarding step should be subscription_payment, got: ' + submitQ18.data.onboarding_step);
  }

  // Directory access should still be blocked awaiting payment
  const postQ18DirCheck = await get('/api/members', authHeaders);
  console.log('   Directory access awaiting payment status:', postQ18DirCheck.status);
  if (postQ18DirCheck.status !== 403) throw new Error('FAILED: Paid member accessed directory without subscription payment!');

  // User completes subscription payment
  console.log('11. User completes annual subscription payment');
  const subRes = await post('/api/membership/activate-subscription', { userId });
  console.log('   Subscription activated:', subRes.data);
  if (subRes.data.subscription_status !== 'active') throw new Error('FAILED: Subscription not active!');
  if (subRes.data.onboarding_step !== 'completed') throw new Error('FAILED: Onboarding step not completed!');

  // Step 10: App opens main tabs
  appView = 'tabs';
  setItem('app_view', appView);
  console.log('12. All required onboarding steps complete. appView =', appView);

  // Member features now fully accessible
  const finalDirCheck = await get('/api/members', authHeaders);
  console.log('   Directory access after payment status:', finalDirCheck.status);
  if (finalDirCheck.status !== 200) throw new Error('FAILED: Directory not accessible after payment!');

  console.log('\n======================================================');
  console.log('ALL MOBILE FLOW & ROUTING CHECKS PASSED WITH 100% SUCCESS!');
  console.log('======================================================');
}

run().catch(err => {
  console.error('\n[SIMULATION ERROR]:', err);
  process.exit(1);
});
