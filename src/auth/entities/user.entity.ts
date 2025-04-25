import { insertDateRegistration } from '../../utils/insert-date';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  TableInheritance,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  email: string;

  @Column('text')
  password: string;

  @Column()
  name: string;

  @Column()
  lastname: string;

  @CreateDateColumn({
    type: 'timestamp',
    // default: () => 'CURRENT_TIMESTAMP',
  })
  dateRegister: Date;

  @Column({ type: 'enum', enum: ['CONSUMER', 'VENDOR'] }) // Opcional, porque el `discriminator` ya diferencia los tipos
  rol: string;

  @BeforeInsert()
  insertDateRegistrationUser() {
    const date = insertDateRegistration();
    this.dateRegister = date;
  }
}
