import { Entity, Column, ChildEntity } from 'typeorm';
import { User } from './user.entity';

@ChildEntity()
export class Admin extends User {
  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date;

  @Column({ type: 'text', nullable: true })
  notes: string; // Notas administrativas
}
