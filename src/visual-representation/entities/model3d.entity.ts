import { ChildEntity, Column, Entity } from 'typeorm';
import { VisualRepresentation } from './visual-representation.entity';

@ChildEntity()
export class Model3D extends VisualRepresentation {
  @Column({
    type: 'enum',
    enum: ['.glb', '.fbx', '.obj', '.dae', '.usd', '.gltf', '.usdz'],
  })
  format: string;

  @Column('text', { nullable: true })
  texture?: string;

  @Column('json')
  scale: object;

  @Column('text', { nullable: true })
  urlIOS3D?: string;
}
