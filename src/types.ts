import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface MyQuery extends DataQuery {
  queryText?: string;
  constant: number;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  constant: 6.5,
};

export interface DataPoint {
  Time: number;
  Value: number;
}

/* export interface DataSourceResponse {
  datapoints: DataPoint[];
} */
export interface DataSourceResponse {
  sid?: string;
  entry?: Array<{ content: { dispatchState: string } }>;
  post_process_count?: number;
  results?: any[];
  fields?: Array<{ name: string }>;
}
/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
// Splunk
export interface SplunkQuery extends DataQuery {
  queryText: string;
}

export const defaultQuery: Partial<SplunkQuery> = {
  queryText: '',
};

/**
 * These are options configured for each DataSource instance
 */
export interface SplunkDataSourceOptions extends DataSourceJsonData {
  endpoint?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface SplunkSecureJsonData {
  basicAuthToken?: string;
}
