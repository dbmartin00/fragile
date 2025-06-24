const axios = require('axios').default;

module.exports = {
    
  login:
        async function login(event) {
          console.log('logging in...');
          // console.log(event);
          let csrf;
          let jwt;


          const rawAuth = `${event.email}:${event.password}`;
          const encodedAuth = Buffer.from(rawAuth).toString('base64');

          const data = {
            authorization: `Basic ${encodedAuth}`
          };

        //console.log('data', data);

        const config = {
          method: 'post',
          url: 'https://app.harness.io/gateway/api/users/login?',
          headers: {
            'accept': '*/*',
            'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'content-type': 'application/json',
            'origin': 'https://app.harness.io',
            'priority': 'u=1, i',
            'referer': 'https://app.harness.io/auth/',
            'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
          },
          data: data
        };

        let remail;
        let ruuid;
        let rtoken;
        let rAccountId;
        let rDefaultAccountId;

        await axios(config)
          .then(response => {
            // console.log('response.data', response.data);
            // console.log('Status:', response.status);
            // console.log('token:', response.data.resource.token);
            rtoken = response.data.resource.token;
            // console.log('defaultAccountId:', response.data.resource.defaultAccountId);
            // console.log('uuid:', response.data.resource.uuid);            
            ruuid = response.data.resource.uuid;
            console.log('name:', response.data.resource.name);
            console.log('email:', response.data.resource.email);
            remail = response.data.resource.email;
            rDefaultAccountId = response.data.resource.defaultAccountId;
            // console.log('defaultAccountId', rDefaultAccountId);
            //console.log('response.data.accounts', response.data.resource.accounts);
            rAccountId = response.data.resource.accounts[0].uuid;
          })
          .catch(error => {
            console.error('Error:', error.response?.data || error.message);
          });

         return { 'email': remail, 'uuid': ruuid, 'token': rtoken, 'accountId': rAccountId, 'defaultAccountId': rDefaultAccountId };
        },      
    getOrgId: async function getOrgId(apiKey, token, accountId) {
        console.log('getting orgId');
        console.log('accountId:' + accountId)
        let statusCode = 401;
        let orgId, splitUserIdentifier, splitUserName, name;
        await axios.get('https://fme-prod.harness.io/internal/api/organizationMemberships', {
          headers: {
            'Fme-Origin': 'app',
            'Fme-Account-Id': accountId,
            'Cookie': `fme-token=${token}`,
            }
          })
          .then(function(response) {
            statusCode = response.status;
            console.log('got organizationMemberships and splitUserIdentifier');
            // console.log(response.data);
            orgId = response.data[0].orgId;
            splitUserIdentifier = response.data[0].userId;
            splitUserName = response.data[0].userURN.name;
            name = response.data[0].orgURN.name;            
            console.log('found orgId: ' + orgId);
          })
          .catch(function(error) {            
            console.log(error);
            statusCode = error.response.status;
          });

          let orgIdentifier;
        try {
          const orgsRes = await axios.get(
            `https://app.harness.io/gateway/ng/api/organizations?accountIdentifier=${accountId}`,
            {
              headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
              },
            }
          ).then(function(response) {
            statusCode = response.status;
            console.log('getOrgId response.data', JSON.stringify(response.data, null, 2));
            for(const o of response.data.data.content) {
              if(o.organization.name.startsWith(name)) {
                console.log('orgIdentifier', o.organization.identifier);
                orgIdentifier = o.organization.identifier;
                break;
              }
            }
          }).catch(function(error) {
            console.log(error);
            statusCode = error.response.status;
          });        

        } catch (err) {
          console.error('Error:', err.response?.data || err.message);
        }

        return { 'statusCode': statusCode, 'orgId': orgId, 'splitUserIdentifier': splitUserIdentifier, 'splitUserName': splitUserName, 'name': name, 'orgIdentifier': orgIdentifier };
     },
    altGetOrgId: async function altGetOrgId(apiKey, token, defaultAccountId, accountId) {
      console.log('altGetOrgId');

      const url = 'https://app.harness.io/gateway/ng/api/user/currentUser?'
        + 'routingId=' + defaultAccountId + '&accountIdentifier=' + accountId;

        await axios.get(url, {
          headers: {
            'x-api-key': apiKey,
            'content-type': 'application/json',
            'Fme-Origin': 'app',
            'Fme-Account-Id': accountId,
            'Cookie': `fme-token=${token}`
          }        
        }).then(function(response) {
          console.log('alt response.data', response.data);
        }).catch(function(error) {
          console.log(error);
        });

    },
    getProject: async function getProject(apiKey, token, accountId, projectName) {
      console.log('getProject');
      
      return axios.get('https://fme-prod.harness.io/internal/api/v2/workspaces', {
        headers: {
          'x-api-key': apiKey,
          // 'Fme-Origin': 'app',
          // 'Fme-Account-Id': accountId,
          // 'Cookie': `fme-token=${token}`,
        }
      })
      .then(function(response) {
        console.log('response.data', response.data);
        console.log('got projects (workspaces)');
        for (const project of response.data.objects) {
          if (project.name === projectName) {
            console.log('found project!');
            return { name: project.name, id: project.id };
          } else {
            console.log('p', project);
          }
        }
        console.warn('project not found');
        return null;
      })
      .catch(function(error) {
        console.log('error', error);
        console.log('Error in getProject:', error.response.data.code + ': ' + error.response.data.message);
        const dbm =  {
          statusCode: error.response.data.code,
          message: error.response.data.code + ': ' + error.response.data.message
        };       
        return dbm;
      });          
    },
    getTrafficTypeId: async function getTrafficTypeId(apiKey, projectId) {
      console.log('getTrafficTypeId');
      console.log('projectId', projectId);  
 
      const url = 'https://fme-prod.harness.io/internal/api/v2/trafficTypes/ws/' + projectId;  

      return axios.get(url, {
        headers: {
          'x-api-key': apiKey,
        }        
      }).then(function(response) {
        for(const trafficType of response.data) {
          if(trafficType.name === 'user') {
            trafficTypeIdentifier = trafficType.id;
            console.log('user trafficTypeId: ' + trafficTypeIdentifier);
            return {'name': trafficType.name, 'id': trafficType.id};
          }
        }        
      }).catch(function (error) {
        console.log(error);
      })
    },
    getEnvironment: async function getEnvironment(apiKey, projectId, environmentName) {
      try {
        console.log('getEnvironment');
        console.log('projectId', projectId);

        const url = 'https://fme-prod.harness.io/internal/api/v2/environments/ws/' + projectId;

        const response = await axios.get(url, {
          headers: { 'x-api-key': apiKey }
        });

        console.log('getEnvironment A response.data', response.data);

        for (const env of response.data) {
          if (env.name === environmentName) {
            return env.id;
          }
        }

        const body = {
          name: environmentName,
          production: true
        };

        const postResponse = await axios.post(url, body, {
          headers: { 'x-api-key': apiKey }
        });

        console.log('success creating environment!');
        console.log('getEnvironment B response.data', postResponse.data);
        return postResponse.data.id;

      } catch (error) {
        console.log('failed to get or create environment');
        console.log('error', error);
        const code = error?.response?.data?.code || 500;
        const message = error?.response?.data?.message || 'Unknown error';

        console.log(`Error in getEnvironment: ${code}: ${message}`);
        return {
          statusCode: code,
          message: `${code}: ${message}`
        };
      }
    },
    createSegment: async function createSegment(apiKey, projectId, segmentName, segmentDescription) {
      console.log('creating segment ' + segmentName);
      const createUrl = 'https://fme-prod.harness.io/internal/api/v2/segments/ws/'+ projectId + '/trafficTypes/user';
      
      const body = {
        name: segmentName,
        description: segmentDescription
      }

      await axios.post(createUrl, body, {
        headers: {
          'x-api-key': apiKey,
        }                
      }).then(function (response) {
        console.log('created segment ' + segmentName);
        console.log('response.data', response.data);
      }).catch(function (error) {
        if(error.status == 409) {
          console.log('segment ' + segmentName + ' already created');
        } else {
          console.log(error);
        }
      })
    },
    defineSegment: async function defineSegment(apiKey, environmentId, segmentName) {
      console.log('defineSegment ' + segmentName);

      const url = 'https://fme-prod.harness.io/internal/api/v2/segments/' + environmentId + '/' + segmentName;

      const body = {};

      await axios.post(url, body, {
        headers: {
          'x-api-key': apiKey,
        }                        
      }).then(function (response) {
        console.log('defined segment ' + segmentName);
        console.log('response.data', response.data)
      }).catch(function(error) {
        if(error.status == 409) {
          console.log('segment ' + segmentName + ' already created');
        } else {
          console.log(error);
        }
      });

    },
    createSplits: async function createSplits(apiKey, projectId, splits, uuid) {
      console.log('createSplits');

      for(const split of splits) {
        console.log('create split ' + split.name);

        const url = 'https://fme-prod.harness.io/internal/api/v2/splits/ws/' + projectId + '/trafficTypes/user';

        const body = {
          name: split.name,
          description: split.description,
            owners: [ 
                  {
                    id: uuid,
                    type: 'user'
                  }
                ]          
        }
        console.log('create split request body', body);
        await axios.post(url, body, {
          headers: {
            'x-api-key': apiKey,
          }                                  
        }).then(function (response) {
          console.log('created split ' + split.name);
        }).catch(function(error) {
          if(error.response.status == 409) {
            console.log('split ' + split.name + ' already created');
          } else {
            console.log(error);
          }
        })
      }
    },
    defineSplits: async function defineSplits(apiKey, projectId, environmentId, splits) {
      console.log('defineSplits');
      console.log(`projectId: ${projectId} environmentId: ${environmentId}`)
      console.log('splits', splits);
      for(const split of splits) {
        console.log('define split ' + split.name);
        const defUrl = 'https://fme-prod.harness.io/internal/api/v2/splits/ws/'+ projectId + '/' + split.name + '/environments/' + environmentId;
        
        const body = split.body;
       
        await axios.post(defUrl, body, { 
            headers: {
              'x-api-key': apiKey,
            }                                            
          })
          .then(function(response) {
              console.log('added definition to split ' + split.name);
          })
          .catch(function(error) {
            if(error.response.status == 409) {
              console.log('split ' + split.name + ' already defined');
            } else {
              console.log(error);
            }
          });
      }

    },
    createServerSideSdkApiKey: async function createServerSideSdkApiKey(apiKey, token, accountId, projectId, projectName, environmentId, environmentName, orgId) {
      console.log('createServerSideSdkApiKey');
      console.log('environmentId', environmentId);

      let serverSideSdkApiKey;

      //
      //
      // Legacy Split API for creating a server-side SDK API key
      //
      const url = 'https://fme-prod.harness.io/internal/api/apiTokens';
      const identifier = 'persuader_' + new Date().getTime();

      const body = {
        orgId: orgId,
        name: identifier,
        scope: 'SDK',
        workspaceIds:[
          projectId
        ],
        environmentIds:[environmentId]
      };


      console.log('create SDK key body', body);
      await axios.post(url, body, {
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          'Fme-Origin': 'app',
          'Fme-Account-Id': accountId,
          'Cookie': `fme-token=${token};token=${token}`                   
        }                
      }).then(function(response) {
        console.log('create SDK Split response', response.data);
        serverSideSdkApiKey = response.data.id;
      }).catch(function(error) {
        console.log(error);
      })

      return serverSideSdkApiKey;      
    },

    createClientSideSdkApiKey: async function createClientSideSdkApiKey(apiKey, token, accountId, projectId, projectName, environmentId, environmentName, orgId) {
      console.log('createClientSideSdkApiKey');
      console.log('environmentId', environmentId);

      let clientSideSdkApiKey;

      //
      //
      // Legacy Split API for creating a server-side SDK API key
      //
      const url = 'https://fme-prod.harness.io/internal/api/apiTokens';
      const identifier = 'fragile_' + new Date().getTime();

      const body = {
        orgId: orgId,
        name: identifier,
        scope: 'SHARED',
        workspaceIds:[
          projectId
        ],
        environmentIds:[environmentId]
      };


      console.log('create SDK key body', body);
      await axios.post(url, body, {
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          'Fme-Origin': 'app',
          'Fme-Account-Id': accountId,
          'Cookie': `fme-token=${token};token=${token}`                   
        }                
      }).then(function(response) {
        console.log('create SDK Split response', response.data);
        clientSideSdkApiKey = response.data.id;
      }).catch(function(error) {
        console.log(error);
      })

      return clientSideSdkApiKey;      
    },    
    getUserSettings: async function getUserSettings(apiKey, token, accountId, defaultAccountId, existingProject) {
      console.log('getUserSettings');

      const url = 'https://app.harness.io/gateway/ng/api/settings?' 
        + 'accountIdentifier=' + accountId
        + '&category=MODULES_VISIBILITY'

      // const url = 'https://app.harness.io/gateway/ng/api/projects/' + existingProject + 
      // + '?accountIdentifier=' + defaultAccountId 
      // + '&accountIdentifier=' + accountId;

      await axios.get(url, {
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          'Fme-Origin': 'app',
          'Fme-Account-Id': accountId,
          'Cookie': `fme-token=${token};token=${token}`
        }            
      }).then(function(response)  {
        console.log('response.data', JSON.stringify(response.data, null, 2));
      }).catch(function(error) {
        console.log(error);
      });
    },
    createProject: async function createProject(apiKey, token, accountId, defaultAccountId, orgId, projectName) {
      console.log('creating project with Harness API: ' + projectName);

      const url = 'https://app.harness.io/gateway/ng/api/projects?' +
        'routingId=' + defaultAccountId +
        '&orgIdentifier=' + orgId;

      const body = {
        project: {
          orgIdentifier: orgId,
          identifier: projectName,
          name: projectName,
          color: "#0063f7",
          modules: ['FME'],
          description: "",
          tags: {}
        }
      };

      console.log('body', body);

      try {
        const response = await axios.post(url, body, {
          headers: {
            'x-api-key': apiKey,
            'content-type': 'application/json',
            'Fme-Origin': 'app',
            'Fme-Account-Id': accountId,
            'Cookie': `fme-token=${token}`
          }
        });

        console.log('response.data', response.data);
        return response.data.data.project.identifier;

      } catch (error) {
        console.error('createProject error', error?.response?.data || error.message);
        return {
          status: error?.response?.status || 500,
          message: error?.response?.data?.message || error.message || 'Unknown error creating project'
        };
      }
    },
    reportSeedEvent: async function reportSeedEvent(serverSideSdkApiKey, events) {
      // FIXME events.split.io endpoint
      const eventsUrl = 'https://events.split.io/api/events';
      let results = [];

      for(const event of events) {
        const body = 
          {
            eventTypeId: event.eventTypeId, 
            trafficTypeName: event.trafficTypeName, 
            key: 'dmartin', 
            timestamp: new Date().getTime(), 
            value: 42,
            properties: event.properties
          }
        console.log('event body: ');
        console.log(body);
        
        for(let i = 0; i < 1; i++) {
          await axios.post(eventsUrl, body, { headers: {'Authorization': 'Bearer ' + serverSideSdkApiKey}})
            .then(function (response) {
              const r = {
                status: response.status,
                result: response.statusText,
                eventTypeId: event.eventTypeId
              }
              results.push(r);
            })
            .catch(function(error) {
              console.log(error);
              const r = {
                status: error.response.status,
                result: error.response.statusText,
                eventTypeId: event.eventTypeId
              }
              results.push(r);
              console.log(error);
            });
        }
      }
      return results;
    },
    createEventTypeIds: async function createEventTypeIds(apiKey, token, accountId, orgId, projectId, projectName, events) {
      const url = 'https://fme-prod.harness.io/internal/api/organization/' + orgId + '/eventTypes';

      for(const event of events) {
        const body = 
        {
           orgId: orgId,
           eventTypeId: event.eventTypeId,
           displayName: event.eventTypeId,
           trafficTypes:[
              {
                 id: trafficTypeIdentifier,
                 orgId: orgId,
                 name: "user",
                 status: "ACTIVE",
                 workspaceIds:[
                    projectId
                 ],
                 displayAttributeId: "name",
                 attributes:[
                    
                 ],
                 segmentMetadatas:null,
                 testMetadatas:null,
                 workspaces:[
                    {
                       id: projectId,
                       name: projectName
                    }
                 ],
                 metrics: null
              }
           ],
           description:"",
           source:"PERSUADER"
        }

        await axios.post(url, body, {
            headers: {
              'Fme-Origin': 'app',
              'Fme-Account-Id': accountId,
              'Cookie': `token=${token}`,
              'x-api-key': apiKey,
              'content-type': 'application/json'              
              }
        })
        .then(function(response) {
          console.log('created eventTypeId: ' + event.eventTypeId);
          console.log(response.status);
        })
        .catch(function(error) {
          console.log(error.response);
          result = error.response.status;
        });
      }
    },
    getEventTrafficTypeId: async function getEventTrafficTypeId(apiKey, projectId) {
      console.log('getEventTrafficTypeId');
      const url = 'https://fme-prod.harness.io/internal/api/v2/trafficTypes/ws/' + projectId;

      let result;
      await axios.get(url, { headers: {'x-api-key': apiKey} })
        .then(function(response) {
          console.log('response.data', response.data);
           for (const trafficType of response.data) {
               if(trafficType.name === 'user') {
                 result = trafficType.id;
                 break;
               }
           }
        })
        .catch(function(err) {
          console.log(err);
        });

      return result;
    },
    getChangeNumber: async function getChangeNumber(splitName, serverSideSdkApiKey) {
      console.log('getChangeNumber');
      let result = 1;

      var config = {
        method: 'get',
        // url: ' https://sdk.split.io/api/splitChanges?since=-1',
        url: ' https://sdk.split.io/api/splitChanges?since=-1',
        headers: { 
          'Authorization': 'Bearer ' + serverSideSdkApiKey,
          'Content-Type': 'application/json'
        }
      };    

      // console.log(eventConfig);
      await axios(config)
      .then(function (response) {
        for(const split of response.data.splits) {
          if(split.name === splitName) {
            result = split.changeNumber;
          }
        }
      })
      .catch(function(error) {
        console.log(error);
      });  

      return result;
    },
    sendImpressions: async function sendImpressions(serverSideSdkApiKey, splitName, stream) {
      console.log('sendImpressions');
      console.log('stream.length ' + stream.length);

      let i_array = [];
      for(const entry of stream) {
        // console.log('entry.data', entry.data);
        i_array.push(entry.data.i);
      }

      // deduplicate
      // let uniqueArr = Array.from(new Set(i_array.map(JSON.stringify))).map(JSON.parse);

      // split name is stable
      const batch = [{f: splitName, i: i_array}];
    
      console.log('flushImpressions');
      // console.log('batch', JSON.stringify(batch, null, 2));
      var config = {
        method: 'post',
        // url: 'https://events.split.io/api/testImpressions/bulk',
        url: 'https://events.split.io/api/testImpressions/bulk',
        headers: { 
          'Authorization': 'Bearer ' + serverSideSdkApiKey, 
          'Content-Type': 'application/json'
        },
        data: batch 
      };
      // console.log(config);
      await axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.status));
      })
      .catch(function (error) {
        console.log(error);
      });        
    },
    sendEvents: async function sendEvents(serverSideSdkApiKey, stream, interval, delta) {
      console.log('sendEvents');
      console.log('stream.length ', stream.length)

      let itr = 0;
      let batch = [];
      for(const entry of stream) {
        let event = entry.event;

        // backdating
        const ts = new Date().getTime() - interval - (delta * itr++);

        // forwardating
        // const ts = new Date().getTime() + interval + (delta * itr++);
        
        event.timestamp = ts;
        // console.log(new Date(ts));
        batch.push(event);
        if(batch.length >= 200) {
          console.log('flushEvents ' + batch.length);
          // console.log('batch', batch);
          var eventConfig = {
            method: 'post',
            url: 'https://events.split.io/api/events/bulk',
            headers: { 
              'Authorization': 'Bearer ' + serverSideSdkApiKey, 
              'Content-Type': 'application/json'
            },
            data : batch
          };    

          // console.log(eventConfig);
          await axios(eventConfig)
          .catch(function(error) {
            console.log(error);
          });  
          batch = [];
        }
      }

      if(batch.length > 0) {
        console.log('flushEvents ' + batch.length);
        // console.log('batch', batch);
        var eventConfig = {
          method: 'post',
          url: 'https://events.split.io/api/events/bulk',
          headers: { 
            'Authorization': 'Bearer ' + serverSideSdkApiKey, 
            'Content-Type': 'application/json'
          },
          data : batch
        };    

        // console.log(eventConfig);
        await axios(eventConfig)
        .catch(function(error) {
          console.log(error);
        });  
        batch = [];
      }
    },
    setCustomVersion: async function setCustomVersion(token, accountId, orgId, uuid, projectId, splitName, environmentId, apiKey, serverSideSdkApiKey) {
      try {
        console.log('setCustomVersion - ' + splitName);

        const splitIdUrl = `https://fme-prod.harness.io/internal/api/v2/splits/ws/${projectId}/${splitName}/environments/${environmentId}`;
        console.log('get test metadata id');
        
        let testMetadataId;
        try {
          const response = await axios.get(splitIdUrl, {
            headers: { 'x-api-key': apiKey }
          });
          console.log('get test metadata id response', response.data);
          testMetadataId = response.data.id;
        } catch (error) {
          console.log('error getting test metadata id', error?.response?.data || error.message);
          return {
            statusCode: error?.response?.status || 500,
            message: 'Failed to fetch test metadata ID: ' + (error?.response?.data?.message || error.message)
          };
        }

        console.log('testMetadataId', testMetadataId);

        const testIdUrl = `https://fme-prod.harness.io/internal/api/testMetadata/${testMetadataId}`;
        console.log('get testId');

        let testId;
        try {
          const response = await axios.get(testIdUrl, {
            headers: {
              'Fme-Origin': 'app',
              'Fme-Account-Id': accountId,
              'Cookie': `token=${token}`,
              'x-api-key': apiKey,
              'content-type': 'application/json'
            }
          });

          for (const view of response.data.views) {
            if (view.testId !== null && view.environmentURN.id === environmentId) {
              testId = view.testId;
              console.log('matched view; found testId', testId);
              break;
            }
          }

          if (!testId) {
            return {
              statusCode: 404,
              message: 'Test ID not found for the given environment.'
            };
          }
        } catch (error) {
          console.log('error getting testId', error?.response?.data || error.message);
          return {
            statusCode: error?.response?.status || 500,
            message: 'Failed to fetch testId: ' + (error?.response?.data?.message || error.message)
          };
        }

        console.log('testId', testId);

        let versionId = '';
        const now = new Date();
        const twoWeeksBeforeNow = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
        const startTimeInUTC = twoWeeksBeforeNow.toISOString();

        const url = 'https://fme-prod.harness.io/bff/v0';

        // Try to fetch an existing custom version
        try {
          const response = await axios.post(url, {
            operationName: null,
            query: `query fetchCustomDate($splitDefinitionId: ID!) {
              experiment_customVersion(splitDefinitionId: $splitDefinitionId) {
                startAt endAt name id
              }
            }`,
            variables: {
              organizationId: orgId,
              orgId,
              userId: uuid,
              splitDefinitionId: testId
            }
          }, {
            headers: {
              'Fme-Origin': 'app',
              'Fme-Account-Id': accountId,
              'Cookie': `token=${token}`,
              'x-api-key': apiKey,
              'content-type': 'application/json'
            }
          });

          versionId = response?.data?.data?.experiment_customVersion?.id;
        } catch (error) {
          console.log('error setting custom version', error?.response?.data || error.message);
          return {
            statusCode: error?.response?.status || 500,
            message: 'Failed to create custom version: ' + (error?.response?.data?.message || error.message)
          };
        }

        if (!versionId) {
          // Create a new custom version
          const createBody = {
            operationName: null,
            query: `mutation updateCustomDate($splitDefinitionId: ID!, $input: CustomVersionInput!) {
              experiment_updateCustomVersion(input: $input, splitDefinitionId: $splitDefinitionId) {
                startAt endAt name id
              }
            }`,
            variables: {
              orgId,
              organizationId: orgId,
              input: {
                startAt: startTimeInUTC,
                endAt: null,
                name: "Custom Version",
                id: null
              },
              splitDefinitionId: testId,
              userId: uuid
            }
          };

          try {
            const response = await axios.post(url, createBody, {
              headers: {
                'Fme-Origin': 'app',
                'Fme-Account-Id': accountId,
                'Cookie': `token=${token}`,
                'x-api-key': apiKey,
                'content-type': 'application/json'
              }
            });
            versionId = response.data.data.experiment_updateCustomVersion.id;
          } catch (error) {
            console.log('error setting custom version', error?.response?.data || error.message);
            return {
              statusCode: error?.response?.status || 500,
              message: 'Failed to create custom version: ' + (error?.response?.data?.message || error.message)
            };
          }
        }

        console.log('versionId', versionId);
        console.log('FINISH set custom version');
        return versionId;

      } catch (err) {
        console.log('Unexpected error in setCustomVersion', err);
        return {
          statusCode: 500,
          message: 'Unexpected error in setCustomVersion: ' + err.message
        };
      }
    }

    ,
    createMetric: async function createMetric(apiKey, token, config, trafficTypeId, accountId, orgId, projectId, splitUserIdentifier, splitUserName) {
      const createMetricUrl = 'https:/app.split.io/internal/api/changeRequests/'
      let result;
      const body =
        {
            orgId: orgId,
            wsId: projectId,
            object: {
                status: null,
                id: null,
                organizationId: orgId,
                name: config.name,
                description: config.description,
                format: "0,0.00",
                positive: config.positive,
                baseEventTypeId: config.baseEventTypeId,
                testMetadataId: null,
                baseEventType: null,
                aggregation: config.aggregation,
                spread: config.spread,
                'trafficTypeId': trafficTypeId,
                filterEventTypeId: "",
                filterAggregation: "",
                filterEventType: null,
                creationTime: null,
                cap: null,
                favorite: null,
                lastUpdateTime: null,
                definitionChangeTime: null,
                tags: [],
                workspaceIds: [
                    projectId
                ],
                owners: [
                    {
                        "id": splitUserIdentifier,
                        "type": "User",
                        "name": splitUserName
                    }
                ],
                trafficTypeURN: null,
                baseEventPropertyFilters: config.baseEventPropertyFilters,
                filterEventPropertyFilters: [],
                type: "Metric"
            },
            change: {
                id: null,
                subject: {
                    type: "User",
                    id: splitUserIdentifier
                },
                verb: "CREATE",
                object: {
                    type: "Metric",
                    id: "previewMetric",
                    name: "David1"
                },
                object2: null,
                time: new Date().getTime(),
                metadata: {},
                organization: null,
                environmentUrn: null,
                environment: null,
                workspaceId: null,
                workspaceIds: null,
                orgId: null,
                title: "Created new metric",
                comment: "Created new metric",
                changeInPlainText: null,
                changeRequest: null
            },
            objectType: "Metric",
            operationType: "CREATE"
        }  
      console.log('creating metric');
      console.log(body);
      console.log(JSON.stringify(body));
      await axios.post(createMetricUrl, body, {
            headers: {
              'Fme-Origin': 'app',
              'Fme-Account-Id': accountId,
              'Cookie': `token=${token}`,
              'x-api-key': apiKey,
              'content-type': 'application/json'              
              }
        })
        .then(async function(response) {
          console.log('created metric!');
          console.log(response.data);
          // DBM replace
          // if(config.alertPolicyDefinition) {
          //   await createAlertPolicy(config, response.data.object.id);
          // }
          result = response.status;
          console.log(response.status);
        })
        .catch(function(error) {
          if(error.response.data.code != 409) {
            console.log('error on metric creation', error);
          }
        });
        
      console.log('metric create statusCode: ' + result);
      return result;
    }

}; 
