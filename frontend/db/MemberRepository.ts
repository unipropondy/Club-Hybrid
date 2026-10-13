import { executeQuery, executeTransaction } from './database';

export interface CachedMember {
  MemberId: string;
  Name: string;
  Phone: string | null;
  Email: string | null;
  Address: string | null;
  CreditLimit: number;
  CurrentBalance: number;
  Balance: number;
  IsActive: boolean;
  IsVIP: boolean;
  VIPType: string | null;
  RewardCredit: number;
  Promocode: string | null;
  Promoamount: number;
}

export interface CachedCreditCustomer {
  CustomerId: string;
  Name: string;
  Phone: string | null;
  Email: string | null;
  Address: string | null;
  CreditLimit: number;
  CurrentBalance: number;
  IsActive: boolean;
  CustomerType: string | null;
}

export class MemberRepository {
  /**
   * Save or replace members into local SQLite cache
   */
  static async saveMembers(members: any[]): Promise<void> {
    if (!members || members.length === 0) return;

    const now = new Date().toISOString();
    const statements = members.map((m) => {
      const id = String(m.MemberId || m.member_id || m.id || '').trim();
      const name = String(m.Name || m.name || '').trim();
      const phone = m.Phone || m.phone || null;
      const email = m.Email || m.email || null;
      const address = m.Address || m.address || null;
      const creditLimit = Number(m.CreditLimit || m.credit_limit || 0);
      const currentBalance = Number(m.CurrentBalance || m.current_balance || 0);
      const balance = Number(m.Balance || m.balance || 0);
      const isActive = (m.IsActive !== false && m.is_active !== 0) ? 1 : 0;
      const isVip = (m.IsVIP === true || m.is_vip === 1 || m.IsVIP === 1) ? 1 : 0;
      const vipType = m.VIPType || m.vip_type || null;
      const rewardCredit = Number(m.RewardCredit || m.reward_credit || 0);
      const promoCode = m.Promocode || m.promo_code || null;
      const promoAmount = Number(m.Promoamount || m.promo_amount || 0);

      return {
        sql: `INSERT OR REPLACE INTO members_cache (
          member_id, name, phone, email, address,
          credit_limit, current_balance, balance,
          is_active, is_vip, vip_type, reward_credit, promo_code, promo_amount, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id, name, phone, email, address,
          creditLimit, currentBalance, balance,
          isActive, isVip, vipType, rewardCredit, promoCode, promoAmount, now
        ],
      };
    });

    try {
      await executeTransaction(statements);
      console.log(`[MemberRepository] Cached ${members.length} members in local SQLite.`);
    } catch (err) {
      console.error('[MemberRepository] Failed to cache members:', err);
    }
  }

  /**
   * Save or replace credit customers into local SQLite cache
   */
  static async saveCreditCustomers(customers: any[]): Promise<void> {
    if (!customers || customers.length === 0) return;

    const now = new Date().toISOString();
    const statements = customers.map((c) => {
      const id = String(c.CustomerId || c.customer_id || c.MemberId || c.id || '').trim();
      const name = String(c.Name || c.name || '').trim();
      const phone = c.Phone || c.phone || null;
      const email = c.Email || c.email || null;
      const address = c.Address || c.address || null;
      const creditLimit = Number(c.CreditLimit || c.credit_limit || 0);
      const currentBalance = Number(c.CurrentBalance || c.current_balance || 0);
      const isActive = (c.IsActive !== false && c.is_active !== 0) ? 1 : 0;
      const customerType = c.CustomerType || c.customer_type || 'CREDIT';

      return {
        sql: `INSERT OR REPLACE INTO credit_customers_cache (
          customer_id, name, phone, email, address,
          credit_limit, current_balance, is_active,
          customer_type, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id, name, phone, email, address,
          creditLimit, currentBalance, isActive,
          customerType, now
        ],
      };
    });

    try {
      await executeTransaction(statements);
      console.log(`[MemberRepository] Cached ${customers.length} credit customers in local SQLite.`);
    } catch (err) {
      console.error('[MemberRepository] Failed to cache credit customers:', err);
    }
  }

  /**
   * Search members or credit customers offline in 0ms using phone or name
   */
  static async searchOffline(query: string, isCredit: boolean = false): Promise<any[]> {
    const q = (query || '').trim();
    if (!q) {
      const table = isCredit ? 'credit_customers_cache' : 'members_cache';
      const idCol = isCredit ? 'customer_id' : 'member_id';
      const rows = await executeQuery(
        `SELECT * FROM ${table} WHERE is_active = 1 ORDER BY name ASC LIMIT 30`
      );
      return rows.map((r: any) => ({
        MemberId: r[idCol],
        CustomerId: r[idCol],
        Name: r.name,
        Phone: r.phone,
        Email: r.email,
        CreditLimit: r.credit_limit,
        CurrentBalance: r.current_balance,
        Balance: r.balance || r.current_balance || 0,
        IsVIP: Boolean(r.is_vip),
        VIPType: r.vip_type,
        RewardCredit: Number(r.reward_credit || 0),
        Promocode: r.promo_code || null,
        Promoamount: Number(r.promo_amount || 0),
      }));
    }

    try {
      const searchTerm = `%${q}%`;
      if (isCredit) {
        const rows = await executeQuery(
          `SELECT * FROM credit_customers_cache 
           WHERE is_active = 1 AND (phone LIKE ? OR name LIKE ? OR email LIKE ?)
           ORDER BY name ASC LIMIT 30`,
          [searchTerm, searchTerm, searchTerm]
        );
        return rows.map((r: any) => ({
          MemberId: r.customer_id,
          CustomerId: r.customer_id,
          Name: r.name,
          Phone: r.phone,
          Email: r.email,
          CreditLimit: r.credit_limit,
          CurrentBalance: r.current_balance,
          Balance: r.current_balance || 0,
        }));
      } else {
        const rows = await executeQuery(
          `SELECT * FROM members_cache 
           WHERE is_active = 1 AND (phone LIKE ? OR name LIKE ? OR email LIKE ?)
           ORDER BY name ASC LIMIT 30`,
          [searchTerm, searchTerm, searchTerm]
        );
        return rows.map((r: any) => ({
          MemberId: r.member_id,
          Name: r.name,
          Phone: r.phone,
          Email: r.email,
          CreditLimit: r.credit_limit,
          CurrentBalance: r.current_balance,
          Balance: r.balance || r.current_balance || 0,
          IsVIP: Boolean(r.is_vip),
          VIPType: r.vip_type,
          RewardCredit: Number(r.reward_credit || 0),
          Promocode: r.promo_code || null,
          Promoamount: Number(r.promo_amount || 0),
        }));
      }
    } catch (err) {
      console.error('[MemberRepository] Offline search error:', err);
      return [];
    }
  }

  /**
   * Deduct credit balance locally during offline settlement
   */
  static async deductCreditBalanceLocally(
    memberId: string,
    amount: number,
    isCredit: boolean = false
  ): Promise<boolean> {
    const table = isCredit ? 'credit_customers_cache' : 'members_cache';
    const idCol = isCredit ? 'customer_id' : 'member_id';
    const now = new Date().toISOString();

    try {
      await executeQuery(
        `UPDATE ${table} 
         SET current_balance = current_balance - ?, updated_at = ?
         WHERE ${idCol} = ?`,
        [amount, now, memberId]
      );
      console.log(`[MemberRepository] Deducted $${amount} locally from ${idCol}: ${memberId}`);
      return true;
    } catch (err) {
      console.error('[MemberRepository] Failed to deduct balance locally:', err);
      return false;
    }
  }
}
