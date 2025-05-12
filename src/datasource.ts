import { getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  // createDataFrame,
  FieldType,
  PartialDataFrame,
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, DataSourceResponse } from './types';
import { lastValueFrom } from 'rxjs';

type TODO = {
  title: string;
  id: number;
};

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  baseUrl: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.baseUrl = instanceSettings.url!;
    console.log('hbh: DataSource constructor');
    console.log('hbh: instanceSettings', instanceSettings);
    console.log('hbh: baseUrl', this.baseUrl); // instance of the datasource
  }

  getDefaultQuery(_: CoreApp): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }

  filterQuery(query: MyQuery): boolean {
    // if no query has been provided, prevent the query from being executed
    return !!query.queryText;
  }

  /* async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options; // options contains a lot of information, in particular all the queryTexts
    const from = range!.from.valueOf();
    const to = range!.to.valueOf();
    console.log('hbh: query');
    console.log('hbh: query options', options);


    // Return a constant for each query.
    const data = options.targets.map((target) => { //data is an array of dataframes
      return createDataFrame({
        refId: target.refId,
        fields: [
          { name: 'Time', values: [from, to], type: FieldType.time },
          { name: 'Value', values: [target.constant, target.constant], type: FieldType.number },
        ],
      });
    }); // end map
    console.log('hbh:data:', data);
    return { data }; //returns an object { data: $data }
  } */
  async query(options: DataQueryRequest): Promise<DataQueryResponse> {
    console.log('hbh: query todos');
    console.log('hbh url:', `${this.baseUrl}/todos`);
    const response = getBackendSrv().fetch<TODO[]>({
      // You can see above that `this.baseUrl` is set in the constructor
      // in this example we assume the configured url is
      // https://jsonplaceholder.typicode.com
      /// if you inspect `this.baseUrl` you'll see the Grafana data proxy url
      url: `${this.baseUrl}/todos`,
    });
    // backendSrv fetch returns an observable object
    // we should unwrap with rxjs
    const responseData = await lastValueFrom(response);
    const todos = responseData.data;
    console.log('hbh: todos:', todos);
    // we'll return the same todos for all queries in this example
    // in a real data source each target should fetch the data
    // as necessary.
    const data: PartialDataFrame[] = options.targets.map((target) => {
      return {
        refId: target.refId,
        fields: [
          { name: 'Id', type: FieldType.number, values: todos.map((todo) => todo.id) },
          { name: 'Title', type: FieldType.string, values: todos.map((todo) => todo.title) },
        ],
      };
    });

    return { data };
  }

  async request(url: string, params?: string) {
    console.log('hbh: url:', `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`);
    const response = getBackendSrv().fetch<DataSourceResponse>({
      url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
    });
    console.log('hbh: response', response);

    return lastValueFrom(response);
  }

  /**
   * Checks whether we can connect to the API.
   */
  async testDatasource() {
    const defaultErrorMessage = 'Cannot connect to API';
    console.log('hbh:testDatasource');

    try {
      const response = await this.request('/todos');
      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Success',
        };
      } else {
        return {
          status: 'error',
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }
    } catch (err) {
      let message = '';
      if (typeof err === 'string') {
        message = err;
      } else if (isFetchError(err)) {
        message = 'Fetch error: ' + (err.statusText ? err.statusText : defaultErrorMessage);
        if (err.data && err.data.error && err.data.error.code) {
          message += ': ' + err.data.error.code + '. ' + err.data.error.message;
        }
      }
      return {
        status: 'error',
        message,
      };
    }
  }
}
