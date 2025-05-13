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
  MutableDataFrame,
  DataFrame,
} from '@grafana/data';

// import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, DataSourceResponse } from './types';
import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, DataSourceResponse, SplunkQuery, SplunkDataSourceOptions} from './types';

import { lastValueFrom } from 'rxjs';

type TODO = {
  title: string;
  id: number;
};

// export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  export class DataSource extends DataSourceApi<SplunkQuery, SplunkDataSourceOptions> {

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

  // Important
  filterQuery(query: SplunkQuery): boolean {
    // if no query has been provided, prevent the query from being executed
    return !!query.queryText;
  }

  appendRows(frame: DataFrame, newRows: Array<Record<string, any>>): DataFrame {
    if (!frame.fields || frame.fields.length === 0) {
      return frame; // Or handle error: cannot append to a frame with no fields
    }
  
    const updatedFields = frame.fields.map((field) => {
      // console.log('hbh: appendRows: field:', field);
      const newValues = [...field.values];
      newRows.forEach((newRow) => {
        // console.log('hbh: appendRows: newRow:', newRow);
        // console.log('hbh: appendRows: field.name:', field.name);
        // console.log('hbh: appendRows: newRow[field.name]:', newRow[field.name]);

        newValues.push(newRow[field.name]);
      });
      // console.log('hbh: appendRows: newValues', newValues);
      return { ...field, values: newValues };
    });
    // console.log('hbh: appendRows: updatedFields', updatedFields);

    return { ...frame, fields: updatedFields };
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
  async queryok(options: DataQueryRequest): Promise<DataQueryResponse> {
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
//
  async query(options: DataQueryRequest<SplunkQuery>): Promise<DataQueryResponse> {
    const moment = require('moment');
    console.log('hbh: query');

    const promises = options.targets.map((query) =>
      this.doRequest(query, options).then((response) => {
        const frame = new MutableDataFrame({
          refId: query.refId,
          fields: [],
        });
        console.log('hbh: frame init: ', frame);


        // console.log(`DEBUG: nFields=${response.fields.length}`);
        // console.log(`DEBUG: nResults=${response.results.length}`);

        //let fields = response.data.fields.map((field: any) => field['name']);
        let fieldsArray: any[] = [];
        response.fields.forEach((field: any) => {
          console.log(`DEBUG: field=${field}`);
          frame.addField({ name: field }); //how does it know the type to add?
          fieldsArray.push({name: field, values:[]});
        });
        console.log('hbh: frame after addField: ', frame);


        const initialFrame: DataFrame = {
          refId: query.refId,
          fields: fieldsArray,
          length: 0,
        };
        let newRowstoAppend: any[] = [];
        response.results.forEach((result: any) => {
          console.log(`DEBUG: result=${JSON.stringify(result)}`);
          let row: any[] = [];
          const rowObj=Object.create(null);

          response.fields.forEach((field: any) => {
            if (field === 'Time') {
              let time = moment(result['_time']).format('YYYY-MM-DDTHH:mm:ssZ');
              row.push(time);
              rowObj['Time'] = time;
            } else {
              row.push(result[field]);
              rowObj[field] = result[field];

            }
          });
          frame.appendRow(row);
          newRowstoAppend.push(rowObj);
        });
        console.log('hbh: newRowstoAppend:', newRowstoAppend);
        const updatedFrame = this.appendRows(initialFrame, newRowstoAppend);
        console.log('hbh: updatedFrame', updatedFrame);
        console.log('hbh: frame: ', frame);
        // return updatedFrame;
        return frame;
      })
    );

  return Promise.all(promises).then((data) => ({ data }));
}

  async doRequest(query: SplunkQuery, options: DataQueryRequest<SplunkQuery>) {
    console.log('chh: doRequest: query:', query);
    const sid: string = await this.doSearchRequest(query, options) ?? '';
    console.log(`DEBUG: sid=${sid}`);

    while (!(await this.doSearchStatusRequest(sid))) {}

    const result = await this.doGetAllResultsRequest(sid);
    return result;
  }
   

  async doSearchRequest(query: SplunkQuery, options: DataQueryRequest<SplunkQuery>) {
    const { range } = options;
    const from = Math.floor(range!.from.valueOf() / 1000);
    const to = Math.floor(range!.to.valueOf() / 1000);

    const data = new URLSearchParams({
      search: `search ${query.queryText}`,
      output_mode: 'json',
      earliest_time: from.toString(),
      latest_time: to.toString(),
    }).toString();
    //
    const defaultErrorMessage = 'Cannot get splunk request sid';

    const fetchresponse = getBackendSrv().fetch<DataSourceResponse>({
      // url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
      method: 'POST',
      url: this.baseUrl + '/services/search/jobs',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: data,
    });
    console.log('hbh: fetchresponse', fetchresponse);

    try {
      //const response = await this.request('/services/search/jobs');
      const response = await lastValueFrom(fetchresponse);
      if (response.status === 201) {
        return response.data.sid;  
      } else {
        console.log('chh: doSearchRequest: response.status', response.status);
        return "status error";
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
      return "catch error";
    }
    
  } 

  async doSearchStatusRequest(sid: string) {

    const fetchresponse = getBackendSrv().fetch<DataSourceResponse>({
      // url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
      method: 'GET',
      url: this.baseUrl + '/services/search/jobs/' + sid,
      params: {
        output_mode: 'json',
      },
    });
    console.log('hbh: doSearchStatusRequest: response', fetchresponse);

    try {
      //const response = await this.request('/services/search/jobs');
      const response = await lastValueFrom(fetchresponse);
      if (response.status === 200) {
        let status = response.data?.entry?.[0]?.content?.dispatchState;
        console.log(`DEBUG: dispatchState=${status}`);
        return status === 'DONE' || status === 'PAUSED' || status === 'FAILED';
      } else {
        return false;
      }
    } catch (err) {     
      return false;
    }
    
  }

  async doGetAllResultsRequest(sid: string) {
    const count = 50000;
    let offset = 0;
    let isFirst = true;
    let isFinished = false;
    let fields: any[] = [];
    let results: any[] = [];
    let ite=0;

    while (!isFinished) {
      const fetchresponse = getBackendSrv().fetch<DataSourceResponse>({
        method: 'GET',
        url: this.baseUrl + '/services/search/jobs/' + sid + '/results',
        params: {
          output_mode: 'json',
          offset: offset,
          count: count,
        },
      });
      console.log('hbh: doGetAllResultsRequest: response', fetchresponse);
      console.log('hbh iteration:', ite);
      ite +=1;
      const response = await lastValueFrom(fetchresponse);
      if ((response.data?.post_process_count ?? 0) === 0 &&  ( response.data?.results?.length ?? 0 ) === 0) {
        isFinished = true;
      } else {
        if (isFirst) {
          isFirst = false;
          fields = response.data?.fields?.map((field: any) => field['name']) ?? [];
        }
        offset = offset + count;
        results = results.concat(response.data.results);
      }
      offset = offset + count;
    }
    

    if (fields.includes('_time')) {
      fields.push('Time');
    }

    const index = fields.indexOf('_raw', 0);
    if (index > -1) {
      fields.splice(index, 1);
      fields = fields.reverse();
      fields.push('_raw');
      fields = fields.reverse();
    }

    return { fields: fields, results: results };
  }
//
  async request(url: string, params?: string) {
    const data = new URLSearchParams({
      search: `search index=_internal * | stats count`,
      output_mode: 'json',
      exec_mode: 'oneshot',
    }).toString();
    console.log('hbh: url:', `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`);
    const response = getBackendSrv().fetch<DataSourceResponse>({
      // url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
      method: 'POST',
      url: this.baseUrl + '/services/search/jobs',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: data,
    });
    console.log('hbh: response', response);

    return lastValueFrom(response);
  }

  /**
   * Checks whether we can connect to the API.
   */
  /* async testDatasource() {
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
  } */
    async testDatasource() {
      const defaultErrorMessage = 'Cannot connect to API';
      console.log('hbh:testDatasource');
//
      const data = new URLSearchParams({
        search: `search index=_internal * | stats count`,
        output_mode: 'json',
        exec_mode: 'oneshot',
      }).toString();
      const fetchresponse = getBackendSrv().fetch<DataSourceResponse>({
        // url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
        method: 'POST',
        url: this.baseUrl + '/services/search/jobs',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: data,
      });
      console.log('hbh: response', fetchresponse);

      // return lastValueFrom(response);
//
      try {
        //const response = await this.request('/services/search/jobs');
        const response = await lastValueFrom(fetchresponse);

        if (response.status === 200) {
          return {
            status: 'success',
            message: 'Successfully connected to datasource',
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

      /* const data = new URLSearchParams({
        search: `search index=_internal * | stats count`,
        output_mode: 'json',
        exec_mode: 'oneshot',
      }).toString();

      const response = getBackendSrv().fetch<DataSourceResponse>({
        method: 'POST',
        url: this.baseUrl + '/services/search/jobs',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: data,
      });
      console.log('hbh: response', response);
  
      const promise = lastValueFrom(response);
      console.log('hbh: promise', promise);

      promise.then( response => {
        if (response.status === 200) {
          return {
            status: 'success',
            message: 'Successfully connected to data source',
          };
        } else {
          return {
            status: 'error',
            message: response.statusText ? response.statusText : defaultErrorMessage,
          };
        }
      }).catch( err => {
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
      }) */
      
    }
}
