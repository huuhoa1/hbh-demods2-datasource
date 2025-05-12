import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { SplunkQuery, SplunkDataSourceOptions } from './types';
// import { MyQuery, MyDataSourceOptions } from './types';


// export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
export const plugin = new DataSourcePlugin<DataSource, SplunkQuery, SplunkDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
