import { useEffect } from 'react';

import { useRevalidateOnInterval } from '~/revalidate-on-interval';
import { getSession } from '~/sessions';

import {
  redirectDocument,
  useLoaderData,
} from '@remix-run/react';
import {fetchDeploymentDetails } from '~/launch-repository';

enum LaunchProjectState {
  NOT_DEPLOYED,
  DEPLOYING,
  LIVE,
  ERROR,
}

const TEXT_FOR_STATE: Record<LaunchProjectState, string> = {
  [LaunchProjectState.NOT_DEPLOYED]: '⏳ Creating Launch project',
  [LaunchProjectState.DEPLOYING]: '🚀 Deploying Launch project...',
  [LaunchProjectState.LIVE]: 'Deployment is Live! Redirecting...',
  [LaunchProjectState.ERROR]: '❗There was an error deploying the project. Please contact someone from the Contentstack booth.',
};

const AVERAGE_DURATION_FOR_DEPLOYMENT_SECONDS = 130;
const POLLING_INTERVAL_SECONDS = 5;

export default function Deploy() {
  const { state, duration }: { state: LaunchProjectState, duration: number } = useLoaderData();
  const pollingEnabled = state === LaunchProjectState.DEPLOYING || state === LaunchProjectState.NOT_DEPLOYED;
  useRevalidateOnInterval({ enabled: pollingEnabled, interval: POLLING_INTERVAL_SECONDS * 1000 });

  useEffect(() => {
    async function callEffect() {
      if (state === LaunchProjectState.NOT_DEPLOYED) {
        await fetch('/build/deploy/launch-project', {
          method: 'POST',
        });
      }
    }

    callEffect();
  }, []);

  const percentage = calculatePercentage(state, duration);

  return (
    <div>
      <h2 id="ProgressLabel" className="my-2 font-medium text-black">{TEXT_FOR_STATE[state]}</h2>

      <span
        role="progressbar"
        aria-labelledby="ProgressLabel"
        aria-valuenow={percentage}
        className="block rounded-full bg-gray-200"
      >
        <span className="block h-4 rounded-full bg-indigo-600 text-center text-[10px]/4" style={{ width: `${percentage}%` }}>
          <span className="font-bold text-white"> {percentage}% </span>
        </span>
      </span>
    </div>
  );
}

function calculatePercentage(state: LaunchProjectState, duration: number) {
  if (state === LaunchProjectState.DEPLOYING) {
    return Math.min(Math.floor((duration / AVERAGE_DURATION_FOR_DEPLOYMENT_SECONDS) * 75) + 25, 100);
  }

  return 0;
}


export async function loader({ request }: { request: Request }) {
  const session = await getSession(
    request.headers.get("Cookie")
  );

  let state = LaunchProjectState.NOT_DEPLOYED;

  if (session.has('launchProjectDetails')) {
    state = LaunchProjectState.DEPLOYING;

    const launchProjectUid = session.get('launchProjectDetails')?.projectUid;
    const launchEnvUid = session.get('launchProjectDetails')?.environmentUid;
    const deploymentUid = session.get('launchProjectDetails')?.deploymentUid;

    const {
      status,
      createdAt,
    } = await fetchDeploymentDetails(session.get('accessToken') as string, session.get('organizationUid') as string, launchEnvUid as string, launchProjectUid as string, deploymentUid as string);
    if (status === 'LIVE') {
      state = LaunchProjectState.LIVE;

      return redirectDocument('/build/complete');
    }
    if (status === 'ERROR') {
      state = LaunchProjectState.ERROR;
    }
    const duration = Math.floor((new Date().getTime() - createdAt.getTime())/1000);
    return { state, duration }; 
  }

  return {state};
}