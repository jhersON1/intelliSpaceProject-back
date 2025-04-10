import { ChildEntity, Column, Entity } from 'typeorm';
import { User } from './user.entity';

@ChildEntity()
export class Vendor extends User {
  @Column('text', { unique: true })
  nombreNegocio: string;

  @Column('text', { nullable: true })
  descripcion: string;

  @Column('text')
  logo: string;

  @Column('text', { array: true })
  documentosVerificacion: string[];

  @Column({ type: 'json' })
  horarioAtencion: object;

  @Column({ type: 'enum', enum: ['INDIVIDUAL', 'EMPRESA'] })
  tipoVendedor: string;
}
