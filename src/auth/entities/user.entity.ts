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
  nombre: string;

  @Column()
  apellido: string;

  @CreateDateColumn({
    type: 'timestamp',
    // default: () => 'CURRENT_TIMESTAMP',
  })
  fechaRegistro: Date;

  @Column({ type: 'enum', enum: ['CONSUMER', 'VENDOR'] }) // Opcional, porque el `discriminator` ya diferencia los tipos
  rol: string;

  @BeforeInsert()
  insertDateRegistrationUser() {
    const date = insertDateRegistration();
    this.fechaRegistro = date;
  }
}
