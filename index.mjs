import pkg from './login.js';

const {
  login,
  getOrgId,
  getProject,
  getTrafficTypeId,
  getEnvironment,
  createSegment,
  defineSegment,
  createSplits,
  defineSplits,
  createServerSideSdkApiKey,
  getUserSettings,
  altGetOrgId,
  createProject,
  reportSeedEvent,
  createEventTypeIds,
  getEventTrafficTypeId,
  getChangeNumber,
  sendImpressions,
  sendEvents,
  setCustomVersion,
  createMetric,
} = pkg;

function logDuration(durationInMillis) {
  const seconds = Math.floor(durationInMillis / 1000);
  const minutes = Math.floor(seconds / 60);
  console.log(`Elapsed time ${minutes % 60} m ${seconds % 60} s`);
}

function buildResponse(statusCode, message, timings, data = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, timings, ...data })
  };
}

async function mentat(token, accountId, orgId, uuid, event, name, serverSideSdkApiKey, impact, eventTypeId, properties, projectId, environmentId, apiKey, timings, start) {
  console.log('mentat');

  if (!mentat._customVersionSet) mentat._customVersionSet = {};

  if (!mentat._customVersionSet[name]) {
    const vId = await setCustomVersion(token, accountId, orgId, uuid, projectId, name, environmentId, apiKey, serverSideSdkApiKey);
    if (vId?.statusCode) {
      timings.push({ description: 'setCustomVersion error: ' + vId.message, elapsedTime: new Date().getTime() - start, success: false });
      return;
    }
    timings.push({ description: 'setCustomVersion', elapsedTime: new Date().getTime() - start, success: true });
    mentat._customVersionSet[name] = true;
  }

  const { onValues, offValues } = generateValues(impact);
  const changeNumber = await getChangeNumber(name, serverSideSdkApiKey);
  const stream = await buildImpressionsAndEvents(event, name, changeNumber, onValues, offValues);

  await sendImpressions(serverSideSdkApiKey, name, stream);
  await sendEvents(serverSideSdkApiKey, stream, interval, delta);
  logDuration(new Date().getTime() - start);
}

function generateValues(impact) {
  const c = (6 * impact) - 200;
  let onValues, offValues, result;
  do {
    onValues = [];
    offValues = [];
    for (let i = 0; i < 1000; i++) {
      const right = Math.cos(i * 4 * (Math.PI / 180)) * 1000;
      const left = (3 * right) / 4;
      const onValue = Math.max(c + right + Math.random() * 100, 1);
      const offValue = Math.max(left + Math.random() * 100, 1);
      onValues.push(onValue);
      offValues.push(offValue);
    }
    const onMean = calculateMean(onValues);
    const offMean = calculateMean(offValues);
    result = (onMean * 100 / offMean) - 100;
  } while (result > 500 || result < -500);

  return { onValues, offValues };
}

function calculateMean(list) {
  return list.reduce((sum, val) => sum + val, 0) / list.length;
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const interval = 1000 * 60 * 60 * 24 * 1;
const delta = 1000 * 60 * 20;

function getTimestamp(itr) {
  return new Date().getTime() - interval - (delta * itr++);
}

async function buildImpressionsAndEvents(event, splitName, changeNumber, onValues, offValues) {
  let stream = [];
  let itr = 0;
  for (let i = 0; i < onValues.length; i++) {
    const treatment = Math.random() > 0.5 ? 'on' : 'off';
    const uuid = uuidv4();
    const ts = getTimestamp(itr++);

    const impression = { k: uuid, t: treatment, m: ts, c: changeNumber, r: 'default rule' };
    const data = { f: splitName, i: impression };
    const e = {
      key: uuid,
      eventTypeId: event.eventTypeId,
      value: treatment === 'on' ? onValues[i] : offValues[i],
      timestamp: Date.now(),
      properties: event.properties,
      trafficTypeName: 'user',
    };

    stream.push({ data, event: e });
  }
  return stream;
}

export const handler = async (e) => {
  const timings = [];
  const start = new Date().getTime();
  timings.push({ description: 'start', elapsedTime: 0, success: true });

  try {
    const body = JSON.parse(e.body);
    const requiredFields = ['email', 'password', 'apiKey', 'projectName', 'environmentName', 'segments', 'splits', 'metrics', 'events'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return buildResponse(422, `missing required ${field}`, timings);
      }
    }

    const { email, password, apiKey, projectName, environmentName, segments, splits, metrics, events } = body;
    timings.push({ description: 'arguments parsed and validates', elapsedTime: new Date().getTime() - start, success: true });

    console.log('segments', segments);
    console.log('splits', splits);

    const result = await login({ email, password });
    timings.push({ description: 'login', elapsedTime: new Date().getTime() - start, success: true });

    if (!result.uuid || !result.token || !result.accountId || !result.defaultAccountId) {
      timings.push({ description: 'login', elapsedTime: new Date().getTime() - start, success: false });
      return buildResponse(401, 'login failed', timings);
    }

    const { token, accountId, uuid, defaultAccountId } = result;
    const orgInfo = await getOrgId(apiKey, token, accountId);
    timings.push({ description: 'getOrgId', elapsedTime: new Date().getTime() - start, success: true });

    if (orgInfo.statusCode >= 300) return buildResponse(orgInfo.statusCode, 'API key invalid', timings);

    const { orgId, splitUserIdentifier, splitUserName, orgIdentifier } = orgInfo;
    let projectInfo = await getProject(apiKey, token, accountId, projectName);
    if (projectInfo?.statusCode) return buildResponse(projectInfo.statusCode, projectInfo.message, timings);
    timings.push({ description: 'getProject', elapsedTime: new Date().getTime() - start, success: true });

    let projectId;
    if (!projectInfo) {
      const result = await createProject(apiKey, token, accountId, defaultAccountId, orgIdentifier, projectName);
      if (result.status >= 300) {
        timings.push({ description: 'createProject', elapsedTime: new Date().getTime() - start, success: false });
        return buildResponse(result.status, result.message, timings);
      }
      projectId = result;
    } else {
      projectId = projectInfo.id;
    }
    projectInfo = await getProject(apiKey, token, accountId, projectName);
    if (projectInfo?.statusCode) return buildResponse(projectInfo.statusCode, projectInfo.message, timings);
    projectId = projectInfo.id;

    const envResult = await getEnvironment(apiKey, projectId, environmentName);
    if (envResult?.statusCode) {
      timings.push({ description: 'getEnvironment', elapsedTime: new Date().getTime() - start, success: false });
      return buildResponse(envResult.statusCode, envResult.message, timings);
    }
    const environmentId = envResult;
    timings.push({ description: 'getEnvironment', elapsedTime: new Date().getTime() - start, success: true });

    let jsonSegments;
    try {
      jsonSegments = typeof segments === 'string' ? JSON.parse(segments) : segments;
      for (const segment of jsonSegments) {
        await createSegment(apiKey, projectId, segment.name, segment.description);
        await defineSegment(apiKey, environmentId, segment.name);
      }
    } catch (err) {
      console.error('JSON parse or loop failure in segments:', err.message);
    }
    timings.push({ description: 'create segments', elapsedTime: new Date().getTime() - start, success: true });

    console.log('raw splits', splits);
    let jsonSplits;
    try {
      jsonSplits = JSON.parse(JSON.parse(splits));      
      console.log('jsonSplits', jsonSplits);
      console.log('jsonSplits.length', jsonSplits.length);
      // for (const split of jsonSplits) {
        await createSplits(apiKey, projectId, jsonSplits, uuid);
        await defineSplits(apiKey, projectId, environmentId, jsonSplits);
    //   }
    } catch (err) {
      console.error('JSON parse or loop failure in splits:', err.message);
    }
    timings.push({ description: 'create splits', elapsedTime: new Date().getTime() - start, success: true });

    const serverSideSdkApiKey = await createServerSideSdkApiKey(apiKey, token, accountId, projectId, projectName, environmentId, environmentName, orgId);
    timings.push({ description: 'create api key', elapsedTime: new Date().getTime() - start, success: true });

    // return buildResponse(200, 'finished provisioning', timings);
    return buildResponse(200, 'finished provisioning', timings, {
      sdkKey: serverSideSdkApiKey
    });

  } catch (err) {
    timings.push({ description: 'error: ' + err.message, elapsedTime: new Date().getTime() - start, success: false });
    return buildResponse(500, err.message, timings);
  } finally {
    timings.push({ description: 'success', elapsedTime: new Date().getTime() - start, success: true });
    logDuration(new Date().getTime() - start);
  }
};
