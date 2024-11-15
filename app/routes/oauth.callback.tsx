import {
  CONTENTSTACK_APP_CLIENT_ID,
  CONTENTSTACK_APP_CLIENT_SECRET,
  OAUTH_REDIRECT_URI,
  TOKEN_URL,
} from '~/constants';
import {
  commitSession,
  getSession,
  SessionProgress,
} from '~/sessions';

import { redirect } from '@remix-run/react';

export default function OAuthCallback() {
  return (
    <p>
      Loading...
    </p>
  )
}

export async function loader({ request }: { request: any }) {
  const code = new URL(request.url).searchParams.get('code');
  if (!code) {
    throw new Error('No code');
  }
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const { accessToken, refreshToken, organizationUid } = await getToken(code);
  session.set('accessToken', accessToken);
  session.set('refreshToken', refreshToken);
  session.set('organizationUid', organizationUid);
  session.set('progress', SessionProgress.QUESTIONS);

  return redirect('/', {
    headers: {
      "Set-Cookie": await commitSession(session),
    }
  });
}

async function getToken(code: string) {
  const body = {
    redirect_uri: OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code',
    client_id: CONTENTSTACK_APP_CLIENT_ID,
    code,
    client_secret: CONTENTSTACK_APP_CLIENT_SECRET,
  };
  const response = await fetch(
    TOKEN_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  const responseJSON = await response.json();
  if (!response.ok) {
    console.log('Debug: Body:', JSON.stringify(body));
    console.error(JSON.stringify(responseJSON));
    throw new Error(JSON.stringify(responseJSON));
  }
  const { access_token, refresh_token, organization_uid } = responseJSON;
  return { accessToken: access_token, refreshToken: refresh_token, organizationUid: organization_uid };
}