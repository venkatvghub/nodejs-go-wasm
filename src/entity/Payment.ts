import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Encrypt } from '../decorators/Encrypt.js';
import { User } from './User.js';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Encrypt()
  card_number!: string;

  @Index('idx_payments_card_number_key_version')
  @Column({ name: 'card_number_key_version', nullable: true, type: 'varchar', length: 100 })
  card_number_key_version?: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Encrypt()
  cvv!: string;

  @Column({ name: 'cvv_key_version', nullable: true, type: 'varchar', length: 100 })
  cvv_key_version?: string;

  @CreateDateColumn()
  created_at!: Date;
}
