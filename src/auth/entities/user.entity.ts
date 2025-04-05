import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';

@Entity('user')
@TableInheritance({ column: { type: 'varchar', name: 'discriminator' } }) // ✔ Se define el discriminador
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column()
  nombre: string;

  @Column()
  apellido: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaRegistro: Date;

  @Column({ type: 'enum', enum: ['CONSUMER', 'VENDOR'] }) // ✔ Opcional, porque el `discriminator` ya diferencia los tipos
  rol: string;
}
