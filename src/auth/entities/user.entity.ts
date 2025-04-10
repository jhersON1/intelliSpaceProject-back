import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  TableInheritance,
  CreateDateColumn,
} from 'typeorm';

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } }) // Se define el discriminador
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
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaRegistro: Date;

  @Column({ type: 'enum', enum: ['CONSUMER', 'VENDOR'] }) // Opcional, porque el `discriminator` ya diferencia los tipos
  rol: string;
}
