import { executeQuery } from './database';

export class SettingsRepository {
  /**
   * Save company settings into SQLite
   */
  static async saveCompanySettings(settings: any): Promise<void> {
    if (!settings) return;
    const now = new Date().toISOString();

    const sql = `INSERT OR REPLACE INTO company_settings_cache (
      id, company_name, address, phone, email, gst_no,
      gst_percentage, tax_mode, service_charge_percentage, takeaway_charges,
      currency, currency_symbol, company_logo_url, halal_logo_url,
      show_company_logo, show_halal_logo, hold_overtime_minutes,
      raw_json, updated_at
    ) VALUES ('1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      settings.CompanyName || settings.company_name || 'My Restaurant',
      settings.Address || settings.address || '',
      settings.Phone || settings.phone || '',
      settings.Email || settings.email || '',
      settings.GSTNo || settings.gst_no || '',
      Number(settings.GSTPercentage || settings.gst_percentage || 0),
      settings.TaxMode || settings.tax_mode || 'exclusive',
      Number(settings.ServiceChargePercentage || settings.service_charge_percentage || 0),
      Number(settings.TakeawayCharges || settings.takeaway_charges || 0),
      settings.Currency || settings.currency || 'SGD',
      settings.CurrencySymbol || settings.currency_symbol || '$',
      settings.CompanyLogoUrl || settings.company_logo_url || '',
      settings.HalalLogoUrl || settings.halal_logo_url || '',
      settings.ShowCompanyLogo ? 1 : 0,
      settings.ShowHalalLogo ? 1 : 0,
      Number(settings.HoldOvertimeMinutes || 30),
      JSON.stringify(settings),
      now,
    ];

    try {
      await executeQuery(sql, params);
      console.log('[SettingsRepository] Saved company settings locally in SQLite.');
    } catch (err) {
      console.error('[SettingsRepository] Failed to save company settings:', err);
    }
  }

  /**
   * Get cached company settings
   */
  static async getCompanySettings(): Promise<any | null> {
    try {
      const rows = await executeQuery(`SELECT * FROM company_settings_cache WHERE id = '1'`);
      if (rows.length === 0) return null;
      const r = rows[0];
      if (r.raw_json) {
        try {
          return JSON.parse(r.raw_json);
        } catch (_) {}
      }
      return {
        CompanyName: r.company_name,
        Address: r.address,
        Phone: r.phone,
        Email: r.email,
        GSTNo: r.gst_no,
        GSTPercentage: r.gst_percentage,
        TaxMode: r.tax_mode,
        ServiceChargePercentage: r.service_charge_percentage,
        TakeawayCharges: r.takeaway_charges,
        Currency: r.currency,
        CurrencySymbol: r.currency_symbol,
      };
    } catch (err) {
      console.error('[SettingsRepository] Failed to get company settings:', err);
      return null;
    }
  }

  /**
   * Save general settings map into SQLite
   */
  static async saveGeneralSettings(settingsMap: Record<string, any>): Promise<void> {
    if (!settingsMap) return;
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(settingsMap)) {
      try {
        await executeQuery(
          `INSERT OR REPLACE INTO general_settings_cache (setting_key, setting_value, updated_at) VALUES (?, ?, ?)`,
          [key, String(typeof value === 'object' ? JSON.stringify(value) : value), now]
        );
      } catch (_) {}
    }
  }

  /**
   * Save active business day (StartDate) into SQLite
   */
  static async saveActiveBusinessDay(startDate: string, isActive: boolean = true, startedBy?: string): Promise<void> {
    if (!startDate) return;
    const now = new Date().toISOString();
    const cleanDate = String(startDate).split('T')[0];

    try {
      await executeQuery(
        `INSERT OR REPLACE INTO business_day_cache (id, start_date, is_active, started_by, updated_at) VALUES ('1', ?, ?, ?, ?)`,
        [cleanDate, isActive ? 1 : 0, startedBy || '', now]
      );
      await executeQuery(
        `INSERT OR REPLACE INTO general_settings_cache (setting_key, setting_value, updated_at) VALUES ('ACTIVE_BUSINESS_DAY', ?, ?)`,
        [cleanDate, now]
      );
      console.log(`[SettingsRepository] Saved active business day (${cleanDate}) locally in SQLite.`);
    } catch (err) {
      console.error('[SettingsRepository] Failed to save active business day:', err);
    }
  }

  /**
   * Get cached active business day
   */
  static async getActiveBusinessDay(): Promise<{ startDate: string | null; isActive: boolean; startedBy?: string } | null> {
    try {
      const rows = await executeQuery(`SELECT * FROM business_day_cache WHERE id = '1'`);
      if (rows.length > 0) {
        const r = rows[0];
        return {
          startDate: r.start_date || null,
          isActive: r.is_active === 1 || r.is_active === true,
          startedBy: r.started_by || '',
        };
      }
      // Fallback check in general_settings_cache
      const genRows = await executeQuery(`SELECT setting_value FROM general_settings_cache WHERE setting_key = 'ACTIVE_BUSINESS_DAY'`);
      if (genRows.length > 0 && genRows[0].setting_value) {
        return {
          startDate: genRows[0].setting_value,
          isActive: true,
        };
      }
      return null;
    } catch (err) {
      console.error('[SettingsRepository] Failed to get active business day:', err);
      return null;
    }
  }

  /**
   * Save license info into SQLite
   */
  static async saveLicenseInfo(license: any): Promise<void> {
    if (!license) return;
    const now = new Date().toISOString();

    const companyName = license.CompanyName || license.company_name || 'Smart POS';
    const address = license.Address || license.address || '';
    const companyLogoUrl = license.CompanyLogoUrl || license.company_logo_url || '';
    const fromDate = license.FromDate || license.from_date || null;
    const toDate = license.ToDate || license.to_date || null;

    try {
      await executeQuery(
        `INSERT OR REPLACE INTO license_cache (id, company_name, address, company_logo_url, from_date, to_date, raw_json, updated_at) VALUES ('1', ?, ?, ?, ?, ?, ?, ?)`,
        [companyName, address, companyLogoUrl, fromDate, toDate, JSON.stringify(license), now]
      );
      console.log('[SettingsRepository] Saved license info locally in SQLite.');
    } catch (err) {
      console.error('[SettingsRepository] Failed to save license info:', err);
    }
  }

  /**
   * Get cached license info
   */
  static async getLicenseInfo(): Promise<any | null> {
    try {
      const rows = await executeQuery(`SELECT * FROM license_cache WHERE id = '1'`);
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        CompanyName: r.company_name,
        Address: r.address,
        CompanyLogoUrl: r.company_logo_url,
        FromDate: r.from_date,
        ToDate: r.to_date,
      };
    } catch (err) {
      console.error('[SettingsRepository] Failed to get license info:', err);
      return null;
    }
  }
}
