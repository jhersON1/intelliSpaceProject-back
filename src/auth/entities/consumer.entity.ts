import { ChildEntity, Column, Entity } from 'typeorm';
import { User } from './user.entity';

@ChildEntity()
export class Consumer extends User {
  @Column('text', { nullable: true })
  address: string;

  @Column({ type: 'json' })
  preferences: object;

  @Column('text', { array: true })
  searchsHistory: string[];

  @Column('text', { nullable: true })
  avatar?: string;
}
