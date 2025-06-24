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
  createClientSideSdkApiKey,
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

    const serverSideSdkApiKey = await createClientSideSdkApiKey(apiKey, token, accountId, projectId, projectName, environmentId, environmentName, orgId);
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
  return buildResponse(200, 'success', timings);
};
