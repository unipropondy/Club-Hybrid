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
}
