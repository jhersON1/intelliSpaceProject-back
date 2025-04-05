import { ChildEntity, Column } from 'typeorm';
import { User } from './user.entity';

@ChildEntity()
export class Consumer extends User {
  @Column('text', { nullable: true })
  direccion: string;

  @Column({ type: 'json' })
  preferencias: object;

  @Column('text', { array: true })
  historialBusquedas: string[];
}
