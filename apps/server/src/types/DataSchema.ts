export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'uuid'
  | 'text'
  | 'json'
  | 'enum';

export type RelationType = 'hasMany' | 'belongsTo' | 'hasOne';

export type OnDeleteAction = 'CASCADE' | 'SET_NULL' | 'RESTRICT';

export interface FieldSchema {
  name: string;
  type: FieldType;
  nullable: boolean;
  isPrimary: boolean;
  isUnique: boolean;
  isRelation: boolean;
  enumValues?: string[];
  defaultValue?: string | number | boolean | null;
}

export interface RelationSchema {
  type: RelationType;
  target: string;
  foreignKey: string;
  onDelete: OnDeleteAction;
}

export interface EntitySchema {
  name: string;
  tableName: string;
  fields: FieldSchema[];
  relations: RelationSchema[];
}

export interface DataSchema {
  entities: EntitySchema[];
}