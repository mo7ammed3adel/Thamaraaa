const crypto = require('crypto');

async function testVercelLogin(email, password) {
  const baseUrl = "https://thamaraaa.vercel.app";
  
  try {
    // 1. Get CSRF token
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    const cookies = csrfRes.headers.get('set-cookie');
    
    // Parse CSRF cookie
    const csrfCookie = cookies.split(',').find(c => c.includes('next-auth.csrf-token'))?.split(';')[0];
    
    // 2. Perform Login POST
    const body = new URLSearchParams();
    body.append('csrfToken', csrfToken);
    body.append('email', email);
    body.append('password', password);
    body.append('redirect', 'false');
    body.append('json', 'true');

    const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": csrfCookie,
        "User-Agent": "Mozilla/5.0",
      },
      body: body.toString()
    });

    const loginData = await loginRes.json();
    console.log(`Login test for ${email}:`, loginData);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

async function main() {
  await testVercelLogin('telesalesmanager@th.com', '123456');
  await testVercelLogin('sales1@th.com', '123456');
}

main();
