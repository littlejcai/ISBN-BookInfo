import { BaseClient } from '@lark-base-open/node-sdk';
import path from 'path'; // Add this line to import the path module
import * as fs from 'fs';

// Coze auth Token
const configPath = path.join(__dirname, "../coze_oauth_config.json");
// Load configuration file
function loadConfig() {
  // Check if configuration file exists
  if (!fs.existsSync(configPath)) {
    throw new Error(
      "Configuration file coze_oauth_config.json does not exist!"
    );
  }

  // Read configuration file
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // Validate required fields
  const requiredFields = [
    "client_type",
    "client_id",
    "public_key_id",
    "private_key",
    "coze_www_base",
    "coze_api_base",
  ];

  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Configuration file missing required field: ${field}`);
    }
    if (typeof config[field] === "string" && !config[field].trim()) {
      throw new Error(`Configuration field ${field} cannot be an empty string`);
    }
  }

  return config;
}

// Load configuration
const config = loadConfig();

// Our official coze sdk for JavaScript [coze-js](https://github.com/coze-dev/coze-js)
import { CozeAPI,getJWTToken } from '@coze/api';

// Get JWT OAuth token directly instead of redirecting
const oauthToken = await getJWTToken({
  baseURL: config.coze_api_base,
  appId: config.client_id,
  aud: new URL(config.coze_api_base).host,
  keyid: config.public_key_id,
  privateKey: config.private_key,
});

console.log('>>> oauthToken', oauthToken);

const apiClient = new CozeAPI({
    token: oauthToken.access_token, 
    baseURL: 'https://api.coze.cn'
});

interface IRecord {
  record_id: string;
  fields: Record<string, any>
}

const APP_TOKEN = process.env['APP_TOKEN']
const PERSONAL_BASE_TOKEN = process.env['PERSONAL_BASE_TOKEN']
const TABLEID = process.env['TABLE_ID']

// search_and_replace
export async function searchAndReplace() {
  
  // new BaseClient，fill appToken & personalBaseToken
  const client = new BaseClient({
    appToken: APP_TOKEN,
    personalBaseToken: PERSONAL_BASE_TOKEN,
  });
  
  // obtain fields info
  const res = await client.base.appTableField.list({
    params: {
      page_size: 100,
    },
    path: {
      table_id: TABLEID,
    }
  });
  const fields = res?.data?.items || [];
  const textFieldNames = fields.map(field => field.field_name);
  console.log('>>> Text fields', JSON.stringify(textFieldNames));

  // iterate over all records
  for await (const data of await client.base.appTableRecord.listWithIterator({ params: { page_size: 50 }, path: { table_id: TABLEID } })) {
    const records = data?.items || [];
    const newRecords: IRecord[] = [];
    for (const record of records) {
      const { record_id, fields } = record || {};
      const entries = Object.entries<string>(fields);
      const newFields: Record<string, string> = {};
      for (const [key, value] of entries) {
        if(key=="isbn") {
          try {
            // 使用 create 方法而不是 stream，或者正确处理 stream 响应
            const book_data = await apiClient.workflows.runs.create({
              workflow_id: '7533103240607596594',
              parameters: {
                "input": value
              },
            });
            const book_data_result = JSON.parse(book_data.data);
            const book_data_obj = JSON.parse(book_data_result.data);
            newFields["book_name"] = book_data_obj.book_name;
            newFields["author"] = book_data_obj.author;
            newFields["description"] = book_data_obj.description;
            newFields["publisher"] = book_data_obj.publisher;
            newFields["total_pages"] = Number(book_data_obj.total_pages);
          } catch (error) {
            console.error('>>> Error calling workflow:', error);
          }
        }
      }
      // add into newRecords if needed
      Object.keys(newFields).length && newRecords.push({
        record_id,
        fields: newFields,
      })
    }
    console.log('>>> new records', JSON.stringify(newRecords));
    
    // batch update records
    await client.base.appTableRecord.batchUpdate({
      path: {
        table_id: TABLEID,
      },
      data: {
        records: newRecords
      }
    })
  }
  console.log('success')
}


console.log('start')