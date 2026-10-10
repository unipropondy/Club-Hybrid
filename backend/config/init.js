const sql = require("mssql");

async function initDB(pool) {
  if (!pool) return;
  console.log("🔄 Running schema check and initialization...");
  try {

  const runQuery = async (name, query) => {
    try {
      await pool.request().query(query);
      console.log(`✅ ${name} OK`);
    } catch (err) {
      console.error(`❌ ${name} FAILED:`, err.message);
    }
  };
    // AUTOMATICALLY GENERATED DDL SCHEMAS FROM UCSCLUB AUDIT
    // ============================================================

    await runQuery("Create __MigrationHistory table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[__MigrationHistory]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[__MigrationHistory](
              [MigrationId] [NVARCHAR](150) NOT NULL,
              [ContextKey] [NVARCHAR](300) NOT NULL,
              [Model] [VARBINARY] NOT NULL,
              [ProductVersion] [NVARCHAR](32) NOT NULL
          )
      END
    `);

    await runQuery("Create AIChatMessages table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AIChatMessages]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[AIChatMessages](
              [MessageID] [INT] NOT NULL,
              [SessionID] [UNIQUEIDENTIFIER] NOT NULL,
              [Sender] [NVARCHAR](50) NOT NULL,
              [ContentText] [NVARCHAR](MAX) NULL,
              [StructuredPayload] [NVARCHAR](MAX) NULL,
              [SQLExecuted] [NVARCHAR](MAX) NULL,
              [ResponseTimeMs] [INT] NULL,
              [Timestamp] [DATETIME] NOT NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create AIChatSessions table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AIChatSessions]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[AIChatSessions](
              [SessionID] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [OrgID] [INT] NULL,
              [StoreID] [INT] NULL,
              [UserID] [INT] NULL,
              [Title] [NVARCHAR](255) NULL,
              [CreatedAt] [DATETIME] NOT NULL DEFAULT (getdate()),
              [LastActivityAt] [DATETIME] NOT NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create AppSettings table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppSettings]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[AppSettings](
              [Id] [INT] NOT NULL,
              [UPI_ID] [NVARCHAR](255) NULL,
              [PayNow_QR_Url] [NVARCHAR](MAX) NULL,
              [ShopName] [NVARCHAR](255) NULL,
              [UpdatedOn] [DATETIME] NULL DEFAULT (getdate()),
              [EnableCheckoutFlow] [BIT] NOT NULL DEFAULT ((1)),
              [EnableDirectProcessToPay] [BIT] NOT NULL DEFAULT ((0)),
              [CustomerSideDisplay] [BIT] NOT NULL DEFAULT ((1)),
              [EnableKOT] [BIT] NOT NULL DEFAULT ((1)),
              [EnableKDS] [BIT] NOT NULL DEFAULT ((1)),
              [EnableCheckoutBill] [BIT] NOT NULL DEFAULT ((1)),
              [EnableQRCodeSettings] [BIT] NOT NULL DEFAULT ((0)),
              [EnableGuestDetailsPopup] [BIT] NOT NULL DEFAULT ((1)),
              [EnableCashDrawer] [BIT] NOT NULL DEFAULT ((0)),
              [EnableKDSPrint] [BIT] NULL DEFAULT ((1)),
              [SVCIdentification] [BIT] NULL DEFAULT ((1)),
              [EnableCombo] [BIT] NULL DEFAULT ((1)),
              [ShowBillTime] [BIT] NULL DEFAULT ((1)),
              [ShowLoyalty] [BIT] NULL DEFAULT ((1)),
              [ShowRewardPoints] [BIT] NULL DEFAULT ((1)),
              [ShowPromoCode] [BIT] NULL DEFAULT ((1)),
              [EnableComboPrint] [BIT] NOT NULL DEFAULT ((0)),
              [EnableSDS] [BIT] NULL DEFAULT ((1)),
              [EnableWaiterMode] [BIT] NULL DEFAULT ((1)),
              [EnableCounterMode] [BIT] NULL DEFAULT ((1)),
              [EnableMixedMode] [BIT] NULL DEFAULT ((1)),
              [EnableAutoAssignment] [BIT] NULL DEFAULT ((1)),
              [EnableQueue] [BIT] NULL DEFAULT ((1)),
              [EnableLiveTimer] [BIT] NULL DEFAULT ((1)),
              [EnableNotifications] [BIT] NULL DEFAULT ((1)),
              [EnablePauseResume] [BIT] NULL DEFAULT ((1)),
              [EnableDelayReason] [BIT] NULL DEFAULT ((1)),
              [EnablePriority] [BIT] NULL DEFAULT ((1)),
              [EnableAssignment] [BIT] NULL DEFAULT ((1)),
              [EnablePickupToken] [BIT] NULL DEFAULT ((1)),
              [ServiceMode] [NVARCHAR](20) NULL DEFAULT ('MIXED'),
              [MaxServiceTimeMinutes] [INT] NULL DEFAULT ((15)),
              [VIPThreshold] [DECIMAL](18, 2) NULL DEFAULT ((5000.00)),
              [VipRuleEnabled] [BIT] NULL DEFAULT ((0)),
              [VipRuleTargetType] [NVARCHAR](50) NULL,
              [VipRuleDishId] [NVARCHAR](MAX) NULL,
              [VipRuleDishGroupId] [NVARCHAR](MAX) NULL,
              [VipRuleDiscountType] [NVARCHAR](50) NULL,
              [VipRuleDiscountValue] [DECIMAL](18, 2) NULL DEFAULT ((0.00)),
              [EnableReceiptPrint] [BIT] NULL DEFAULT ((1)),
              [SkipSummary] [BIT] NULL DEFAULT ((0)),
              [EnableDirectPaymentToProcess] [BIT] NOT NULL DEFAULT ((0)),
              [EnableSkipSummaryScreen] [BIT] NOT NULL DEFAULT ((0)),
              [EnableOnlinePayment] [BIT] NOT NULL DEFAULT ((1)),
              [EnableCookingInstructions] [BIT] NOT NULL DEFAULT ((1)),
              [EnableQROrderAutoPrint] [BIT] NULL DEFAULT ((1)),
              [EnableRequestService] [BIT] NULL DEFAULT ((1)),
              [EnableVoiceSuccess] [BIT] NULL DEFAULT ((1)),
              [EnableNotificationSound] [BIT] NULL DEFAULT ((1))
          )
      END
    `);

    await runQuery("Create ArtistBonusMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ArtistBonusMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ArtistBonusMaster](
              [Id] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [ThresholdAmount] [DECIMAL](18, 2) NOT NULL,
              [BonusAmount] [DECIMAL](18, 2) NOT NULL,
              [IsRepeating] [BIT] NOT NULL DEFAULT ((1)),
              [IsActive] [BIT] NOT NULL DEFAULT ((1)),
              [ArtistDishId] [UNIQUEIDENTIFIER] NULL,
              [ArtistType] [NVARCHAR](100) NULL,
              [CreatedDate] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create ArtistBonusPayment table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ArtistBonusPayment]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ArtistBonusPayment](
              [Id] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [BonusTransactionId] [UNIQUEIDENTIFIER] NOT NULL,
              [ArtistDishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ArtistName] [NVARCHAR](200) NOT NULL,
              [PaymentAmount] [DECIMAL](18, 2) NOT NULL,
              [PaidDate] [DATETIME] NOT NULL DEFAULT (getdate()),
              [PaidBy] [NVARCHAR](100) NOT NULL,
              [Remarks] [NVARCHAR](500) NULL,
              [CreatedDate] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create ArtistBonusTransaction table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ArtistBonusTransaction]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ArtistBonusTransaction](
              [Id] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [ArtistDishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ArtistName] [NVARCHAR](200) NOT NULL,
              [SalesFromDate] [DATETIME] NOT NULL,
              [SalesToDate] [DATETIME] NOT NULL,
              [TotalSales] [DECIMAL](18, 2) NOT NULL,
              [ThresholdAmount] [DECIMAL](18, 2) NOT NULL,
              [BonusRuleAmount] [DECIMAL](18, 2) NOT NULL,
              [BonusEarned] [DECIMAL](18, 2) NOT NULL,
              [IsRepeating] [BIT] NOT NULL DEFAULT ((1)),
              [CreatedDate] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create ArtistCashBox table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ArtistCashBox]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ArtistCashBox](
              [CashBoxId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [ArtistId] [UNIQUEIDENTIFIER] NULL,
              [ArtistName] [VARCHAR](100) NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL DEFAULT ((0)),
              [SettlementDate] [DATETIME] NOT NULL DEFAULT (getdate()),
              [CreatedDate] [DATETIME] NOT NULL DEFAULT (getdate()),
              [start_date] [DATE] NULL,
              [SettlementID] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create AutoNumbers table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AutoNumbers]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[AutoNumbers](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [TableName] [VARCHAR](50) NOT NULL,
              [FieldName] [VARCHAR](50) NOT NULL,
              [Prefix] [VARCHAR](10) NULL,
              [PrefixDelimiter] [VARCHAR](10) NULL,
              [NextNumber] [DECIMAL](18, 2) NOT NULL DEFAULT ((1)),
              [NumberDigits] [DECIMAL](18, 2) NOT NULL DEFAULT ((5)),
              [SuffixDelimiter] [VARCHAR](10) NULL,
              [Suffix] [VARCHAR](10) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create BarCodeMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BarCodeMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[BarCodeMaster](
              [Id] [UNIQUEIDENTIFIER] NOT NULL,
              [BarCode] [VARCHAR](20) NOT NULL,
              [Description] [VARCHAR](50) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [DishId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create BrandMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BrandMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[BrandMaster](
              [BrandId] [UNIQUEIDENTIFIER] NULL,
              [BrandCode] [VARCHAR](20) NULL,
              [BrandName] [VARCHAR](50) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create BusinessDayAuditLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BusinessDayAuditLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[BusinessDayAuditLog](
              [AuditId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [BusinessDate] [DATE] NOT NULL,
              [EventType] [VARCHAR](20) NOT NULL,
              [EventTime] [DATETIME] NOT NULL DEFAULT (getdate()),
              [ActionBy] [VARCHAR](30) NULL,
              [Remarks] [NVARCHAR](255) NULL
          )
      END
    `);

    await runQuery("Create BusinessDayLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BusinessDayLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[BusinessDayLog](
              [LogId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [BusinessDate] [DATE] NOT NULL,
              [StartedAt] [DATETIME] NULL,
              [StartedBy] [VARCHAR](30) NULL,
              [EndedAt] [DATETIME] NULL,
              [EndedBy] [VARCHAR](30) NULL
          )
      END
    `);

    await runQuery("Create CancelRemarksMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CancelRemarksMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CancelRemarksMaster](
              [CRCode] [VARCHAR](50) NULL,
              [CRName] [VARCHAR](100) NULL,
              [SortCode] [INT] NULL,
              [IsActive] [BIT] NULL DEFAULT ((1))
          )
      END
    `);

    await runQuery("Create CardNumber table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CardNumber]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CardNumber](
              [CNOrderId] [UNIQUEIDENTIFIER] NULL,
              [CNOrderNumber] [VARCHAR](20) NULL,
              [CardNumber] [VARCHAR](20) NULL
          )
      END
    `);

    await runQuery("Create CartItems table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CartItems]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CartItems](
              [ItemId] [NVARCHAR](128) NOT NULL,
              [CartId] [NVARCHAR](128) NULL,
              [Quantity] [INT] NOT NULL,
              [DateCreated] [DATETIME] NOT NULL,
              [ProductId] [NVARCHAR](128) NULL,
              [OrderNo] [NVARCHAR](MAX) NULL,
              [OrderConfirmQty] [INT] NOT NULL,
              [MobileNo] [NVARCHAR](50) NULL,
              [Cost] [DECIMAL](18, 2) NULL,
              [IsTakeaway] [BIT] NULL DEFAULT ((0)),
              [IsVoided] [BIT] NULL DEFAULT ((0)),
              [Note] [NVARCHAR](MAX) NULL,
              [ModifiersJSON] [NVARCHAR](MAX) NULL,
              [Spicy] [NVARCHAR](50) NULL,
              [Salt] [NVARCHAR](50) NULL,
              [Oil] [NVARCHAR](50) NULL,
              [Sugar] [NVARCHAR](50) NULL,
              [Status] [NVARCHAR](20) NULL DEFAULT ('NEW'),
              [VoidReason] [NVARCHAR](MAX) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [DiscountType] [NVARCHAR](20) NULL DEFAULT ('fixed'),
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create CartitemsModifier table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CartitemsModifier]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CartitemsModifier](
              [CartId] [NVARCHAR](MAX) NULL,
              [ProductId] [NVARCHAR](MAX) NULL,
              [MobileNo] [NVARCHAR](100) NULL,
              [ModifierName] [NVARCHAR](MAX) NULL,
              [ModifierCode] [VARCHAR](20) NULL,
              [DetailID] [UNIQUEIDENTIFIER] NULL,
              [ModfierCost] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create CartitemsModifierDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CartitemsModifierDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CartitemsModifierDetail](
              [CartId] [NVARCHAR](MAX) NULL,
              [ProductId] [NVARCHAR](MAX) NULL,
              [MobileNo] [NVARCHAR](100) NULL,
              [Dishid] [UNIQUEIDENTIFIER] NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NULL,
              [DetailID] [UNIQUEIDENTIFIER] NULL,
              [ModfierCost] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create CashDrawerLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CashDrawerLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CashDrawerLog](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [LocationCode] [VARCHAR](20) NULL,
              [UserId] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [Description] [VARCHAR](50) NULL,
              [LogId] [UNIQUEIDENTIFIER] NULL,
              [OutletId] [INT] NOT NULL DEFAULT ((1)),
              [ActionType] [NVARCHAR](30) NULL,
              [Amount] [DECIMAL](18, 2) NULL,
              [TenderedAmount] [DECIMAL](18, 2) NULL,
              [ChangeAmount] [DECIMAL](18, 2) NULL,
              [Reason] [NVARCHAR](100) NULL,
              [Remark] [NVARCHAR](500) NULL,
              [OpenedByUserId] [NVARCHAR](100) NULL,
              [ApprovedByUserId] [NVARCHAR](100) NULL,
              [OpenSource] [NVARCHAR](20) NOT NULL DEFAULT ('MANUAL'),
              [OrderId] [NVARCHAR](100) NULL,
              [IsSuccess] [BIT] NOT NULL DEFAULT ((1)),
              [start_date] [DATE] NULL
          )
      END
    `);

    await runQuery("Create CashDrawerRemarks table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CashDrawerRemarks]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CashDrawerRemarks](
              [CRCode] [VARCHAR](100) NULL,
              [CRName] [VARCHAR](100) NULL,
              [SortCode] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [Description] [NVARCHAR](100) NOT NULL DEFAULT ('')
          )
      END
    `);

    await runQuery("Create CashierSettlement table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CashierSettlement]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CashierSettlement](
              [SettlementId] [UNIQUEIDENTIFIER] NOT NULL,
              [CashierId] [UNIQUEIDENTIFIER] NOT NULL,
              [Date] [DATETIME] NOT NULL,
              [TerminalCode] [VARCHAR](10) NOT NULL,
              [PayMode] [VARCHAR](15) NOT NULL,
              [ComputerAmount] [NUMERIC](18, 2) NULL,
              [ManualAmount] [NUMERIC](18, 2) NULL,
              [SortOrExces] [NUMERIC](18, 2) NULL,
              [shift] [VARCHAR](10) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL
          )
      END
    `);

    await runQuery("Create CashInEntry table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CashInEntry]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CashInEntry](
              [CashInId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [CashInNo] [NVARCHAR](50) NULL,
              [CashInDate] [DATE] NULL DEFAULT (CONVERT([date],getdate(),0)),
              [Amount] [DECIMAL](18, 2) NULL,
              [Reason] [NVARCHAR](255) NULL,
              [Remarks] [NVARCHAR](255) NULL,
              [PaymentMode] [NVARCHAR](50) NULL DEFAULT ('Cash'),
              [ReferenceNo] [NVARCHAR](100) NULL,
              [TerminalCode] [NVARCHAR](50) NULL,
              [CreatedBy] [NVARCHAR](100) NULL,
              [CreatedOn] [DATETIME] NULL DEFAULT (getdate()),
              [start_date] [DATE] NULL,
              [AttachmentUrl] [NVARCHAR](500) NULL
          )
      END
    `);

    await runQuery("Create CashOutEntry table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CashOutEntry]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CashOutEntry](
              [CashOutId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [CashOutNo] [NVARCHAR](50) NULL,
              [CashOutDate] [DATE] NULL DEFAULT (CONVERT([date],getdate(),0)),
              [Amount] [DECIMAL](18, 2) NULL,
              [Reason] [NVARCHAR](255) NULL,
              [Remarks] [NVARCHAR](MAX) NULL,
              [PaymentMode] [NVARCHAR](50) NULL,
              [ReferenceNo] [NVARCHAR](100) NULL,
              [TerminalCode] [NVARCHAR](50) NULL,
              [CreatedBy] [NVARCHAR](100) NULL,
              [CreatedOn] [DATETIME] NULL,
              [start_date] [DATE] NULL,
              [AttachmentUrl] [NVARCHAR](500) NULL
          )
      END
    `);

    await runQuery("Create CategoryKitchenType table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CategoryKitchenType]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CategoryKitchenType](
              [CategoryId] [UNIQUEIDENTIFIER] NOT NULL,
              [KitchenTypeCode] [VARCHAR](5) NOT NULL,
              [KitchenTypeName] [VARCHAR](50) NOT NULL
          )
      END
    `);

    await runQuery("Create CategoryMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CategoryMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CategoryMaster](
              [CategoryId] [UNIQUEIDENTIFIER] NOT NULL,
              [CategoryCode] [VARCHAR](10) NOT NULL,
              [CategoryName] [NVARCHAR](300) NULL,
              [ShortName] [VARCHAR](10) NULL,
              [NameInOtherLanguage] [NVARCHAR](300) NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [BackColor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [isKitchenPrint] [BIT] NOT NULL DEFAULT ((1)),
              [isDiscountAllowed] [BIT] NOT NULL DEFAULT ((1)),
              [isServiceCharge] [BIT] NOT NULL DEFAULT ((1)),
              [IsDispName] [BIT] NOT NULL DEFAULT ((1)),
              [isMemberSalesAllowed] [BIT] NOT NULL DEFAULT ((0)),
              [IsTaxAllowed] [BIT] NOT NULL DEFAULT ((1)),
              [SortCode] [INT] NOT NULL,
              [isActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [CategoryImage] [NVARCHAR](MAX) NULL,
              [IsPublished] [BIT] NULL
          )
      END
    `);

    await runQuery("Create CategoryModifier table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CategoryModifier]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CategoryModifier](
              [CategoryId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create CloudExtractConfiguration table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CloudExtractConfiguration]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CloudExtractConfiguration](
              [CompanyID] [INT] NULL,
              [CompanyCode] [VARCHAR](50) NULL,
              [DataGroup] [VARCHAR](50) NULL,
              [FileName] [VARCHAR](255) NOT NULL,
              [TableName] [VARCHAR](255) NULL,
              [FmtFileName] [VARCHAR](255) NULL,
              [ExtractQuery] [NVARCHAR](MAX) NULL,
              [LocationCode] [NCHAR](20) NULL,
              [Flag] [NCHAR](2) NULL,
              [ApplicationType] [VARCHAR](10) NULL
          )
      END
    `);

    await runQuery("Create ComboGroupDishMapping table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ComboGroupDishMapping]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ComboGroupDishMapping](
              [MappingId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [ComboGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Surcharge] [DECIMAL](18, 2) NOT NULL DEFAULT ((0.00)),
              [IsDefault] [BIT] NOT NULL DEFAULT ((0)),
              [SortOrder] [INT] NOT NULL DEFAULT ((0)),
              [StoreId] [UNIQUEIDENTIFIER] NULL,
              [IsActive] [BIT] NOT NULL DEFAULT ((1)),
              [CreatedOn] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create ComboGroupMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ComboGroupMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ComboGroupMaster](
              [ComboGroupId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [ParentComboDishId] [UNIQUEIDENTIFIER] NOT NULL,
              [GroupName] [NVARCHAR](100) NOT NULL,
              [DisplayOrder] [INT] NOT NULL DEFAULT ((0)),
              [MinSelection] [INT] NOT NULL DEFAULT ((1)),
              [MaxSelection] [INT] NOT NULL DEFAULT ((1)),
              [IsMultiSelect] [BIT] NOT NULL DEFAULT ((0)),
              [IsActive] [BIT] NOT NULL DEFAULT ((1)),
              [CreatedOn] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create CompanySettings table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CompanySettings]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CompanySettings](
              [Id] [NVARCHAR](128) NOT NULL,
              [CompanyName] [NVARCHAR](255) NULL,
              [Address] [NVARCHAR](MAX) NULL,
              [GSTNo] [NVARCHAR](50) NULL,
              [GSTPercentage] [DECIMAL](18, 2) NULL,
              [Phone] [NVARCHAR](50) NULL,
              [Email] [NVARCHAR](255) NULL,
              [CashierName] [NVARCHAR](255) NULL,
              [Currency] [NVARCHAR](10) NULL,
              [CurrencySymbol] [NVARCHAR](10) NULL,
              [CompanyLogoUrl] [NVARCHAR](MAX) NULL,
              [HalalLogoUrl] [NVARCHAR](MAX) NULL,
              [ShowCompanyLogo] [BIT] NULL,
              [ShowHalalLogo] [BIT] NULL,
              [UpdatedOn] [DATETIME] NULL DEFAULT (getdate()),
              [PrinterIP] [NVARCHAR](50) NULL,
              [TaxMode] [NVARCHAR](20) NULL DEFAULT ('exclusive'),
              [WaiterRequired] [BIT] NULL DEFAULT ((1)),
              [HoldOvertimeMinutes] [INT] NULL DEFAULT ((30)),
              [ServiceChargePercentage] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [LastBridgeHeartbeat] [DATETIME] NULL,
              [SVCIdentification] [BIT] NOT NULL DEFAULT ((1)),
              [TakeawayCharges] [DECIMAL](18, 2) NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create CreditCustomerMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CreditCustomerMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CreditCustomerMaster](
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [Name] [NVARCHAR](255) NOT NULL,
              [Phone] [NVARCHAR](50) NULL,
              [Email] [NVARCHAR](255) NULL,
              [Address] [NVARCHAR](MAX) NULL,
              [IsActive] [BIT] NULL DEFAULT ((1)),
              [Balance] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [CreditLimit] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [CurrentBalance] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [CreatedOn] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create CreditPayment table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CreditPayment]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CreditPayment](
              [CreditPaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreditNumber] [VARCHAR](20) NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NULL,
              [Paymode] [CHAR](10) NULL,
              [Amount] [DECIMAL](18, 2) NULL,
              [ReferenceNumber] [VARCHAR](20) NULL,
              [Remarks] [VARCHAR](150) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL,
              [ReturnAmt] [NUMERIC](10, 2) NULL,
              [PayAmount] [NUMERIC](10, 2) NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL DEFAULT ((0)),
              [isUploadHQ] [BIT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create CreditPaymentDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CreditPaymentDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CreditPaymentDetail](
              [CreditPaymentDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreditPaymentId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [BalanceAmount] [DECIMAL](18, 2) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create CurrencyDenomination table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CurrencyDenomination]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CurrencyDenomination](
              [CurrencyId] [UNIQUEIDENTIFIER] NULL,
              [CurrencyValue] [NUMERIC](18, 2) NOT NULL
          )
      END
    `);

    await runQuery("Create CustomerCreditAllocations table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CustomerCreditAllocations]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CustomerCreditAllocations](
              [AllocationId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [PaymentTransactionId] [UNIQUEIDENTIFIER] NOT NULL,
              [InvoiceTransactionId] [UNIQUEIDENTIFIER] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [CreatedDate] [DATETIME2] NOT NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create CustomerCreditTransactions table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CustomerCreditTransactions]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CustomerCreditTransactions](
              [TransactionId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [MemberId] [UNIQUEIDENTIFIER] NOT NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [BillNo] [NVARCHAR](50) NULL,
              [TransactionType] [NVARCHAR](20) NOT NULL,
              [BillAmount] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [PaidAmount] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [OutstandingAmount] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [PaymentMethod] [NVARCHAR](50) NULL,
              [ReferenceNo] [NVARCHAR](100) NULL,
              [Status] [NVARCHAR](20) NULL DEFAULT ('OPEN'),
              [Remarks] [NVARCHAR](500) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedDate] [DATETIME2] NOT NULL DEFAULT (getdate()),
              [UpdatedDate] [DATETIME2] NULL,
              [CustomerType] [NVARCHAR](20) NULL,
              [start_date] [DATE] NULL
          )
      END
    `);

    await runQuery("Create CustomerDishLoyaltyState table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CustomerDishLoyaltyState]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CustomerDishLoyaltyState](
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL,
              [RuleId] [UNIQUEIDENTIFIER] NOT NULL,
              [CurrentCount] [INT] NOT NULL DEFAULT ((0)),
              [RewardsAvailable] [INT] NOT NULL DEFAULT ((0)),
              [RewardCyclesCompleted] [INT] NOT NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create CustomerMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CustomerMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CustomerMaster](
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL,
              [CustomerCode] [VARCHAR](20) NOT NULL,
              [Name] [VARCHAR](160) NOT NULL,
              [ContactPerson] [VARCHAR](100) NOT NULL,
              [GovermentId] [VARCHAR](50) NOT NULL,
              [CategoryCode] [INT] NOT NULL,
              [ClassificationCode] [INT] NOT NULL,
              [EmailId1] [VARCHAR](100) NULL,
              [EmailId2] [VARCHAR](100) NULL,
              [WebSite] [VARCHAR](200) NULL,
              [Address1_Name] [VARCHAR](200) NULL,
              [Address1_Id] [UNIQUEIDENTIFIER] NULL,
              [Address1_TypeCode] [INT] NOT NULL,
              [Address1_PrimaryContactName] [VARCHAR](150) NULL,
              [Address1_Line1] [VARCHAR](50) NOT NULL,
              [Address1_Line2] [VARCHAR](50) NULL,
              [Address1_Line3] [VARCHAR](50) NULL,
              [Address1_City] [VARCHAR](50) NULL,
              [Address1_State] [VARCHAR](50) NULL,
              [Address1_Country] [VARCHAR](50) NULL,
              [Address1_PostalCode] [VARCHAR](20) NULL,
              [Address1_Telephone1] [VARCHAR](20) NOT NULL,
              [Address1_Telephone2] [VARCHAR](20) NULL,
              [Address1_Fax] [VARCHAR](20) NULL,
              [Address1_FreightTermCode] [INT] NULL,
              [Address1_ShippingMethodCode] [INT] NULL,
              [Address2_Name] [VARCHAR](200) NULL,
              [Address2_Id] [UNIQUEIDENTIFIER] NULL,
              [Address2_TypeCode] [INT] NULL,
              [Address2_PrimaryContactName] [VARCHAR](150) NULL,
              [Address2_Line1] [VARCHAR](50) NULL,
              [Address2_Line2] [VARCHAR](50) NULL,
              [Address2_Line3] [VARCHAR](50) NULL,
              [Address2_City] [VARCHAR](50) NULL,
              [Address2_State] [VARCHAR](50) NULL,
              [Address2_Country] [VARCHAR](50) NULL,
              [Address2_PostalCode] [VARCHAR](20) NULL,
              [Address2_Telephone1] [VARCHAR](20) NULL,
              [Address2_Telephone2] [VARCHAR](20) NULL,
              [Address2_Fax] [VARCHAR](20) NULL,
              [Address2_FreightTermCode] [INT] NULL,
              [Address2_ShippingMethodCode] [INT] NULL,
              [PaymentTermsCode] [INT] NULL,
              [CreditLimit] [DECIMAL](18, 2) NULL,
              [CreditOnHold] [BIT] NULL,
              [RevenueThisYear] [DECIMAL](18, 2) NULL,
              [Aging30] [DECIMAL](18, 2) NULL,
              [Aging60] [DECIMAL](18, 2) NULL,
              [Aging90] [DECIMAL](18, 2) NULL,
              [StatusCode] [INT] NOT NULL,
              [OwnerBusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [GstType] [CHAR](1) NULL,
              [isServiceChargeAllowed] [BIT] NULL,
              [DOB] [SMALLDATETIME] NULL,
              [Anniversary] [SMALLDATETIME] NULL,
              [CardNo] [VARCHAR](20) NULL,
              [FromDate] [DATETIME] NULL,
              [ToDate] [DATETIME] NULL,
              [Remarks] [VARCHAR](100) NULL,
              [Clssificationcodename] [VARCHAR](100) NULL,
              [Photo] [IMAGE] NULL,
              [ic] [IMAGE] NULL,
              [MealRates] [INT] NULL DEFAULT ((0)),
              [OpeningBalance] [INT] NULL DEFAULT ((0)),
              [RouteId] [UNIQUEIDENTIFIER] NULL DEFAULT (''),
              [MemberMealAllowed] [INT] NULL DEFAULT ((0)),
              [InvoiceDate] [DATETIME] NULL,
              [Nosales] [INT] NULL DEFAULT ((0)),
              [TotalPoints] [NUMERIC](10, 2) NULL DEFAULT ((0)),
              [RedeemPoints] [NUMERIC](10, 2) NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create CustomerMealDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CustomerMealDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CustomerMealDetail](
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [CateringStartDate] [DATETIME] NULL,
              [CateringEndDate] [DATETIME] NULL,
              [MonthlyRate] [MONEY] NULL,
              [MealTypes] [UNIQUEIDENTIFIER] NULL,
              [MealQty] [DECIMAL](30, 2) NULL,
              [MealTypeRates] [DECIMAL](30, 2) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [Mutton] [INT] NULL,
              [Chicken] [INT] NULL,
              [Beef] [INT] NULL
          )
      END
    `);

    await runQuery("Create CustomerTransaction table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CustomerTransaction]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[CustomerTransaction](
              [CustomerCode] [CHAR](20) NULL,
              [InvoiceNo] [CHAR](20) NULL,
              [InvoiceDate] [SMALLDATETIME] NULL,
              [InvoiceAmount] [MONEY] NULL,
              [CustomerDiscount] [MONEY] NULL,
              [RewardPoint] [NUMERIC](18, 2) NULL,
              [PaymentId] [UNIQUEIDENTIFIER] NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [BussinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [CreateUser] [UNIQUEIDENTIFIER] NULL,
              [CreateDate] [SMALLDATETIME] NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [SMALLDATETIME] NULL
          )
      END
    `);

    await runQuery("Create DailyAttendance table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DailyAttendance]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DailyAttendance](
              [DeliveryPersonId] [UNIQUEIDENTIFIER] NOT NULL,
              [StartDateTime] [DATETIME] NOT NULL,
              [EndDateTime] [DATETIME] NOT NULL,
              [NoofHours] [DECIMAL](10, 2) NOT NULL,
              [NoofTrips] [INT] NOT NULL,
              [TotalAmount] [DECIMAL](18, 2) NOT NULL,
              [IsPaid] [BIT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [BreakInTime] [DATETIME] NULL,
              [BreakOutTime] [DATETIME] NULL,
              [EmployeeName] [NVARCHAR](255) NULL
          )
      END
    `);

    await runQuery("Create DailyAttendanceLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DailyAttendanceLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DailyAttendanceLog](
              [DeliveryPersonId] [UNIQUEIDENTIFIER] NOT NULL,
              [StartDateTime] [DATETIME] NOT NULL,
              [EndDateTime] [DATETIME] NOT NULL,
              [NoofHours] [DECIMAL](10, 2) NOT NULL,
              [NoofTrips] [INT] NOT NULL,
              [TotalAmount] [DECIMAL](18, 2) NOT NULL,
              [IsPaid] [BIT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DailyOrderSequenceNumber table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DailyOrderSequenceNumber]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DailyOrderSequenceNumber](
              [NextDailyOrderSequenceNumber] [INT] NULL
          )
      END
    `);

    await runQuery("Create DailyUserVoidAndCancelRecordsLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DailyUserVoidAndCancelRecordsLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DailyUserVoidAndCancelRecordsLog](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [SettlementID] [UNIQUEIDENTIFIER] NULL,
              [UserID] [UNIQUEIDENTIFIER] NULL,
              [Shift] [NUMERIC](18, 2) NULL,
              [TerminalCode] [VARCHAR](50) NULL,
              [Date] [DATETIME] NULL,
              [DailyVoidLimit] [NUMERIC](18, 2) NULL,
              [DailyCancelLimit] [NUMERIC](18, 2) NULL,
              [CurrentVoidAmount] [NUMERIC](18, 2) NULL,
              [CurrentCancelAmount] [NUMERIC](18, 2) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [isUploadHQ] [BIT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create DateEntry table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DateEntry]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DateEntry](
              [DateEntryId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [username] [VARCHAR](100) NULL,
              [StartDate] [DATE] NOT NULL,
              [Createdby] [VARCHAR](100) NULL,
              [CreatedDate] [DATETIME] NULL DEFAULT (getdate()),
              [updateby] [VARCHAR](100) NULL,
              [updatedate] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DeliveryPerson table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DeliveryPerson]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DeliveryPerson](
              [DeliveryPersonId] [UNIQUEIDENTIFIER] NULL,
              [DeliveryPersonCode] [VARCHAR](50) NULL,
              [DeliveryPersonName] [VARCHAR](50) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [VARCHAR](50) NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create Discount table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Discount]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Discount](
              [Discountid] [UNIQUEIDENTIFIER] NOT NULL,
              [DiscountCode] [VARCHAR](20) NOT NULL,
              [Description] [VARCHAR](50) NULL,
              [FromDate] [SMALLDATETIME] NULL,
              [ToDate] [SMALLDATETIME] NULL,
              [DiscountQty] [NUMERIC](18, 2) NOT NULL,
              [Discountprice] [NUMERIC](18, 2) NOT NULL,
              [ActualPrice] [NUMERIC](18, 2) NOT NULL DEFAULT ((0)),
              [isActive] [BIT] NOT NULL DEFAULT ((1)),
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedDate] [DATETIME] NULL,
              [Modyfiedby] [UNIQUEIDENTIFIER] NULL,
              [ModyfiedDate] [DATETIME] NULL,
              [DiscountPercentage] [NUMERIC](18, 2) NULL,
              [isGuestMeal] [BIT] NULL DEFAULT ((0)),
              [Paymode] [INT] NULL,
              [Backcolor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create DiscountLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DiscountLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DiscountLog](
              [Discountid] [UNIQUEIDENTIFIER] NOT NULL,
              [DiscountCode] [VARCHAR](20) NOT NULL,
              [Description] [VARCHAR](50) NULL,
              [FromDate] [SMALLDATETIME] NULL,
              [ToDate] [SMALLDATETIME] NULL,
              [DiscountQty] [NUMERIC](18, 2) NOT NULL,
              [Discountprice] [NUMERIC](18, 2) NOT NULL,
              [ActualPrice] [NUMERIC](18, 2) NOT NULL,
              [isActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedDate] [DATETIME] NULL,
              [Modyfiedby] [UNIQUEIDENTIFIER] NULL,
              [ModyfiedDate] [DATETIME] NULL,
              [DeletedUser] [UNIQUEIDENTIFIER] NULL,
              [DeletedDate] [DATETIME] NULL,
              [Flag] [CHAR](1) NULL
          )
      END
    `);

    await runQuery("Create DishAssociation table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishAssociation]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishAssociation](
              [AssociatedDishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishAssociationId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL
          )
      END
    `);

    await runQuery("Create DishDishGroup table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishDishGroup]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishDishGroup](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [QOIId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create DishEquipment table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishEquipment]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishEquipment](
              [DishEquipmentId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [EquipmentId] [UNIQUEIDENTIFIER] NOT NULL,
              [Quantity] [DECIMAL](18, 2) NULL,
              [UOM] [UNIQUEIDENTIFIER] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DishGroupKitchentype table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishGroupKitchentype]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishGroupKitchentype](
              [DishGroupid] [UNIQUEIDENTIFIER] NULL,
              [KitchenTypeCode] [VARCHAR](5) NULL,
              [KitchenTypeName] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create DishgroupList table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishgroupList]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishgroupList](
              [DishgroupId] [UNIQUEIDENTIFIER] NULL,
              [DishgroupCode] [NCHAR](10) NULL,
              [Description] [VARCHAR](300) NULL,
              [CategoryId] [UNIQUEIDENTIFIER] NULL,
              [Imageid] [UNIQUEIDENTIFIER] NULL,
              [isActive] [BIT] NULL,
              [SortCode] [INT] NULL
          )
      END
    `);

    await runQuery("Create DishGroupMapping table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishGroupMapping]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishGroupMapping](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL
          )
      END
    `);

    await runQuery("Create DishGroupMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishGroupMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishGroupMaster](
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishGroupCode] [VARCHAR](20) NOT NULL,
              [DishGroupName] [NVARCHAR](150) NULL,
              [SortCode] [INT] NOT NULL,
              [IsActive] [BIT] NOT NULL DEFAULT ((1)),
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [ShortName] [VARCHAR](10) NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [BackColor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [isKitchenprint] [BIT] NULL,
              [isDiscountAllowed] [BIT] NULL,
              [isServiceCharge] [BIT] NULL,
              [IsDispName] [BIT] NULL,
              [isMemberSalesAllowed] [BIT] NULL,
              [IsTaxAllowed] [BIT] NULL,
              [NameInOtherLanguage] [NVARCHAR](150) NULL,
              [CategoryId] [UNIQUEIDENTIFIER] NULL,
              [KitchenSortCode] [INT] NULL DEFAULT ((0)),
              [IsShowinKiosk] [BIT] NULL,
              [ShowModifierTabOrder] [INT] NOT NULL DEFAULT ((1)),
              [DishGroupImage] [NVARCHAR](MAX) NULL,
              [IsPublished] [BIT] NULL
          )
      END
    `);

    await runQuery("Create DishGroupModifier table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishGroupModifier]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishGroupModifier](
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DishIngredient table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishIngredient]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishIngredient](
              [DishIngredientId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [IngredientId] [UNIQUEIDENTIFIER] NOT NULL,
              [IsRestockIngredient] [BIT] NOT NULL,
              [ReOrderQuantity] [DECIMAL](18, 2) NULL,
              [ReOrderUOM] [UNIQUEIDENTIFIER] NULL,
              [CookingPax] [INT] NULL,
              [CookingQuantity] [DECIMAL](18, 2) NULL,
              [CookingUOM] [UNIQUEIDENTIFIER] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [IsDish] [BIT] NULL
          )
      END
    `);

    await runQuery("Create DishKitchentype table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishKitchentype]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishKitchentype](
              [Dishid] [UNIQUEIDENTIFIER] NULL,
              [KitchenTypeCode] [VARCHAR](5) NULL,
              [KitchenTypeName] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create DishList table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishList]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishList](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Description] [VARCHAR](300) NULL,
              [isActive] [BIT] NULL,
              [SortCode] [INT] NULL,
              [DishgroupId] [UNIQUEIDENTIFIER] NULL,
              [CategoryId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create DishMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishMaster](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [DishCode] [VARCHAR](20) NOT NULL,
              [Name] [NVARCHAR](300) NULL,
              [NameInOtherLanguage] [NVARCHAR](150) NULL,
              [Description] [NVARCHAR](4000) NULL,
              [KitchenType] [INT] NOT NULL,
              [SubkitchenType] [INT] NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [DefaultPriceListId] [UNIQUEIDENTIFIER] NULL,
              [CurrentCost] [DECIMAL](18, 2) NULL,
              [CookingBusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [QuantityOnHand] [DECIMAL](18, 2) NULL,
              [SupplierId] [UNIQUEIDENTIFIER] NULL,
              [IsActive] [BIT] NOT NULL DEFAULT ((1)),
              [IsStandardMenu] [BIT] NULL,
              [IsStockDish] [BIT] NULL,
              [IsDoorDeliveryDish] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [iskitchenPrint] [BIT] NULL,
              [isServiceCharge] [BIT] NULL,
              [SordCode] [NUMERIC](10, 2) NULL,
              [ShortName] [VARCHAR](15) NULL,
              [MobileTab] [INT] NULL,
              [isDiscountAllowed] [BIT] NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [BrandId] [UNIQUEIDENTIFIER] NULL,
              [backColor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [isFOC] [BIT] NULL DEFAULT ((0)),
              [isOpenitem] [BIT] NULL DEFAULT ((0)),
              [UnitCost] [NUMERIC](18, 2) NULL,
              [Discountid] [UNIQUEIDENTIFIER] NULL,
              [IsDispName] [BIT] NULL,
              [isIngredient] [BIT] NULL,
              [IsTaxAllowed] [BIT] NULL,
              [isMultiPrice] [BIT] NULL DEFAULT ((0)),
              [IsShowinKiosk] [BIT] NULL,
              [AvailableTimeFrom] [VARCHAR](100) NULL,
              [AvailableTimeTo] [VARCHAR](100) NULL,
              [isFavourite] [BIT] NULL,
              [DishImage] [NVARCHAR](MAX) NULL,
              [SongName] [NVARCHAR](200) NULL,
              [IsSplitDish] [BIT] NULL DEFAULT ((0)),
              [IsgroupDish] [BIT] NULL DEFAULT ((0)),
              [IsCombo] [BIT] NOT NULL DEFAULT ((0)),
              [IsDeck] [BIT] NOT NULL DEFAULT ((0)),
              [IsSoldOut] [BIT] NULL,
              [IsPublished] [BIT] NULL,
              [TakeawayCharge] [DECIMAL](18, 2) NOT NULL DEFAULT ((0.00))
          )
      END
    `);

    await runQuery("Create DishMaster_IsShowinKiosk table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishMaster_IsShowinKiosk]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishMaster_IsShowinKiosk](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishCode] [VARCHAR](20) NOT NULL,
              [Name] [NVARCHAR](300) NULL,
              [NameInOtherLanguage] [NVARCHAR](150) NULL,
              [Description] [NVARCHAR](4000) NULL,
              [KitchenType] [INT] NOT NULL,
              [SubkitchenType] [INT] NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [DefaultPriceListId] [UNIQUEIDENTIFIER] NULL,
              [CurrentCost] [DECIMAL](18, 2) NULL,
              [CookingBusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [QuantityOnHand] [DECIMAL](18, 2) NULL,
              [SupplierId] [UNIQUEIDENTIFIER] NULL,
              [IsActive] [BIT] NOT NULL,
              [IsStandardMenu] [BIT] NULL,
              [IsStockDish] [BIT] NULL,
              [IsDoorDeliveryDish] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [iskitchenPrint] [BIT] NULL,
              [isServiceCharge] [BIT] NULL,
              [SordCode] [NUMERIC](10, 2) NULL,
              [ShortName] [VARCHAR](15) NULL,
              [MobileTab] [INT] NULL,
              [isDiscountAllowed] [BIT] NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [BrandId] [UNIQUEIDENTIFIER] NULL,
              [backColor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [isFOC] [BIT] NULL,
              [isOpenitem] [BIT] NULL,
              [UnitCost] [NUMERIC](18, 2) NULL,
              [Discountid] [UNIQUEIDENTIFIER] NULL,
              [IsDispName] [BIT] NULL,
              [isIngredient] [BIT] NULL,
              [IsTaxAllowed] [BIT] NULL,
              [isMultiPrice] [BIT] NULL,
              [IsShowinKiosk] [BIT] NULL
          )
      END
    `);

    await runQuery("Create DishModifier table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishModifier]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishModifier](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DishModifierCustomerOrder table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishModifierCustomerOrder]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishModifierCustomerOrder](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DishModifiers table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishModifiers]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishModifiers](
              [Id] [INT] NOT NULL,
              [DishId] [INT] NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create dishOrderItemShare table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[dishOrderItemShare]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[dishOrderItemShare](
              [Id] [UNIQUEIDENTIFIER] NULL DEFAULT (newid()),
              [CustomerName] [NVARCHAR](100) NULL,
              [IsSelected] [BIT] NULL DEFAULT ((1)),
              [CreatedDate] [DATETIME] NULL DEFAULT (getdate()),
              [Amount] [DECIMAL](18, 2) NULL,
              [FromDate] [DATE] NULL,
              [ToDate] [DATE] NULL,
              [DishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDishId] [UNIQUEIDENTIFIER] NULL,
              [TargetAmount] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create DishPriceList table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishPriceList]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishPriceList](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [PriceListId] [UNIQUEIDENTIFIER] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DishSetMeal table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishSetMeal]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishSetMeal](
              [DishSetMealId] [UNIQUEIDENTIFIER] NULL,
              [DishId] [UNIQUEIDENTIFIER] NULL,
              [OptionNo] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DishTSGroup table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishTSGroup]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishTSGroup](
              [GroupCode] [CHAR](20) NULL,
              [Description] [CHAR](50) NOT NULL,
              [CreateUser] [CHAR](10) NULL,
              [CreateDate] [DATETIME] NOT NULL,
              [ModifyUser] [CHAR](10) NULL,
              [ModifyDate] [DATETIME] NOT NULL,
              [SortCode] [NUMERIC](18, 2) NULL,
              [TerminalGroup] [VARCHAR](20) NULL
          )
      END
    `);

    await runQuery("Create DishTSList table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DishTSList]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DishTSList](
              [InventoryCode] [CHAR](20) NULL,
              [Description] [CHAR](50) NOT NULL,
              [GroupCode] [CHAR](20) NULL,
              [CreateUser] [CHAR](10) NULL,
              [CreateDate] [DATETIME] NOT NULL,
              [ModifyUser] [CHAR](10) NULL,
              [ModifyDate] [DATETIME] NOT NULL,
              [SortCode] [NUMERIC](18, 2) NULL,
              [TerminalGroup] [VARCHAR](100) NULL
          )
      END
    `);

    await runQuery("Create Display table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Display]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Display](
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishName] [VARCHAR](100) NOT NULL,
              [Qty] [DECIMAL](18, 2) NOT NULL,
              [Price] [DECIMAL](18, 2) NOT NULL,
              [Total] [DECIMAL](18, 2) NOT NULL,
              [Status] [VARCHAR](50) NOT NULL,
              [TableNo] [VARCHAR](50) NULL,
              [TerminalCode] [VARCHAR](50) NULL,
              [SeqNo] [INT] NULL,
              [QtyStatus] [CHAR](1) NULL,
              [ModifierName] [VARCHAR](1000) NULL
          )
      END
    `);

    await runQuery("Create DoorDeliveryMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliveryMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliveryMaster](
              [OrderTypeCode] [VARCHAR](20) NULL,
              [OrderTypeName] [VARCHAR](50) NULL,
              [IsActive] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [NCHAR](10) NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [NCHAR](10) NULL
          )
      END
    `);

    await runQuery("Create DoorDeliveryOrder table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliveryOrder]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliveryOrder](
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DoorDeliveryOrderNumber] [VARCHAR](20) NOT NULL,
              [Title] [VARCHAR](300) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL,
              [ContactPerson] [VARCHAR](100) NOT NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [FunctionDateTime] [DATETIME] NULL,
              [DateFullfilled] [DATETIME] NULL,
              [PaymentTermCode] [INT] NULL,
              [PriceLevelId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [OperationDescription] [VARCHAR](100) NULL,
              [BillToName] [VARCHAR](200) NULL,
              [BillTo_Line1] [VARCHAR](50) NULL,
              [BillTo_Line2] [VARCHAR](50) NULL,
              [BillTo_Line3] [VARCHAR](50) NULL,
              [BillTo_City] [VARCHAR](50) NULL,
              [BillTo_State] [VARCHAR](50) NULL,
              [BillTo_Country] [VARCHAR](50) NULL,
              [BillTo_PostalCode] [VARCHAR](20) NULL,
              [BillTo_Telephone] [VARCHAR](20) NULL,
              [BillTo_Fax] [VARCHAR](20) NULL,
              [ShippingMethodCode] [INT] NULL,
              [ShipTo_Name] [VARCHAR](200) NULL,
              [ShipTo_Line1] [VARCHAR](50) NULL,
              [ShipTo_Line2] [VARCHAR](50) NULL,
              [ShipTo_Line3] [VARCHAR](50) NULL,
              [ShipTo_City] [VARCHAR](50) NULL,
              [ShipTo_State] [VARCHAR](50) NULL,
              [ShipTo_Country] [VARCHAR](50) NULL,
              [ShipTo_PostalCode] [VARCHAR](20) NULL,
              [ShipTo_Telephone] [VARCHAR](20) NULL,
              [ShipTo_Fax] [VARCHAR](20) NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [DailyOrderSequenceNumber] [INT] NULL,
              [InformKitchen] [BIT] NULL,
              [IsViewed] [BIT] NULL,
              [PriorityCode] [INT] NULL,
              [DeliveryPersonId] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DoorDeliveryOrderDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliveryOrderDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliveryOrderDetail](
              [DoorDeliveryOrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Discription] [VARCHAR](150) NOT NULL,
              [Quantity] [DECIMAL](18, 2) NOT NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [AssociatedDishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [Dishname] [VARCHAR](300) NULL
          )
      END
    `);

    await runQuery("Create DoorDeliveryOrderDetailLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliveryOrderDetailLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliveryOrderDetailLog](
              [DoorDeliveryOrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Discription] [VARCHAR](150) NOT NULL,
              [Quantity] [DECIMAL](18, 2) NOT NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [AssociatedDishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DoorDeliveryOrderEquipment table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliveryOrderEquipment]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliveryOrderEquipment](
              [DoorDeliveryOrderEquipmentId] [UNIQUEIDENTIFIER] NOT NULL,
              [DoorDeliveryOrderOrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [EquipmentId] [UNIQUEIDENTIFIER] NOT NULL,
              [EquipmentFor] [INT] NOT NULL,
              [Quantity] [DECIMAL](18, 2) NOT NULL,
              [UOM] [INT] NOT NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NOT NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NOT NULL,
              [StatusCode] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DoorDeliveryOrderMenuDish table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliveryOrderMenuDish]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliveryOrderMenuDish](
              [DoorDeliveryOrderMenuDishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DoorDeliveryOrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [StatusCode] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create DoorDeliveryPaymentDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliveryPaymentDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliveryPaymentDetail](
              [PaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [BilledFor] [INT] NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryPersonId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NOT NULL,
              [PaymentType] [INT] NOT NULL,
              [Paymode] [INT] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [ReferenceNumber] [VARCHAR](20) NULL,
              [Remarks] [VARCHAR](150) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL,
              [ReturnAmt] [NUMERIC](10, 2) NULL,
              [PayAmount] [NUMERIC](10, 2) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL,
              [PaymodeServiceChargeAmount] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL
          )
      END
    `);

    await runQuery("Create DoorDeliveryPaymentDetailCur table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliveryPaymentDetailCur]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliveryPaymentDetailCur](
              [PaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [BilledFor] [INT] NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryPersonId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NOT NULL,
              [PaymentType] [INT] NOT NULL,
              [Paymode] [INT] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [ReferenceNumber] [VARCHAR](20) NULL,
              [Remarks] [VARCHAR](150) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL,
              [ReturnAmt] [NUMERIC](10, 2) NULL,
              [PayAmount] [NUMERIC](10, 2) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL,
              [PaymodeServiceChargeAmount] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL
          )
      END
    `);

    await runQuery("Create DoorDeliveryPrintReport table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliveryPrintReport]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliveryPrintReport](
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [Ordernumber] [VARCHAR](20) NOT NULL,
              [PrintType] [INT] NOT NULL,
              [orderDate] [DATETIME] NOT NULL,
              [isEditOrder] [BIT] NULL
          )
      END
    `);

    await runQuery("Create DoorDeliverySettlementHeader table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DoorDeliverySettlementHeader]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DoorDeliverySettlementHeader](
              [SettlementID] [UNIQUEIDENTIFIER] NULL,
              [CashierID] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [Shift] [NUMERIC](18, 2) NULL,
              [TerminalCode] [VARCHAR](50) NULL,
              [LastSettlementDate] [DATETIME] NULL,
              [OutstandingAmount] [MONEY] NULL,
              [PayAmount] [MONEY] NULL,
              [SysAmount] [MONEY] NULL,
              [ManualAmount] [MONEY] NULL,
              [SortageOrExces] [MONEY] NULL,
              [isDayEnd] [BIT] NULL,
              [LastDayEndDate] [DATETIME] NULL,
              [RoundedBy] [MONEY] NULL,
              [TotalTax] [MONEY] NULL,
              [DeliveryCharge] [MONEY] NULL,
              [DiscountAmount] [MONEY] NULL,
              [SubTotal] [MONEY] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [TotalPax] [NUMERIC](18, 2) NULL,
              [Tips] [MONEY] NULL,
              [VoidAmount] [MONEY] NULL,
              [InvoiceCount] [NUMERIC](8, 2) NULL,
              [VoidItemQty] [NUMERIC](8, 2) NULL,
              [VoidItemAmount] [MONEY] NULL,
              [ExItemQty] [NUMERIC](18, 2) NULL,
              [ExItemAmount] [MONEY] NULL,
              [DisItemAmount] [MONEY] NULL,
              [PaymodeServiceCharge] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL,
              [RefundQty] [NUMERIC](18, 2) NULL,
              [RefundAmount] [NUMERIC](18, 4) NULL,
              [AdditionalServiceCharge] [MONEY] NULL
          )
      END
    `);

    await runQuery("Create dtproperties table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[dtproperties]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[dtproperties](
              [id] [INT] NOT NULL,
              [objectid] [INT] NULL,
              [property] [VARCHAR](64) NOT NULL,
              [value] [VARCHAR](255) NULL,
              [uvalue] [NVARCHAR](255) NULL,
              [lvalue] [IMAGE] NULL,
              [version] [INT] NOT NULL DEFAULT (0)
          )
      END
    `);

    await runQuery("Create EmailList table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EmailList]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[EmailList](
              [EMailid] [VARCHAR](100) NOT NULL,
              [ReportName] [VARCHAR](50) NOT NULL,
              [Active] [BIT] NOT NULL,
              [Createdby] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [UserName] [CHAR](50) NULL
          )
      END
    `);

    await runQuery("Create emaillisttmp table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[emaillisttmp]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[emaillisttmp](
              [EMailid] [VARCHAR](100) NOT NULL,
              [ReportName] [VARCHAR](50) NOT NULL,
              [Active] [BIT] NOT NULL,
              [Createdby] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [UserName] [CHAR](50) NULL
          )
      END
    `);

    await runQuery("Create EquipmentMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EquipmentMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[EquipmentMaster](
              [EquipmentId] [UNIQUEIDENTIFIER] NOT NULL,
              [EquipmentCode] [VARCHAR](20) NOT NULL,
              [EquipmentName] [VARCHAR](100) NOT NULL,
              [UnitRate] [DECIMAL](18, 2) NULL,
              [UOM] [INT] NULL,
              [IsActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create FacilityMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FacilityMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[FacilityMaster](
              [FacilityId] [UNIQUEIDENTIFIER] NOT NULL,
              [FacilityCode] [VARCHAR](20) NOT NULL,
              [Name] [VARCHAR](100) NOT NULL,
              [PersonIncharge] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [LocationId] [UNIQUEIDENTIFIER] NOT NULL,
              [IsActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CratedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create FireCourse table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FireCourse]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[FireCourse](
              [FireCourseId] [UNIQUEIDENTIFIER] NOT NULL,
              [FireCourseCode] [VARCHAR](20) NOT NULL,
              [FireCourseName] [VARCHAR](50) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create Forms table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Forms]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Forms](
              [FormCode] [CHAR](6) NOT NULL,
              [FormDescription] [CHAR](100) NULL,
              [FormGroupCode] [CHAR](10) NULL,
              [MenuName] [VARCHAR](50) NULL,
              [MenuText] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create GcmRegister table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[GcmRegister]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[GcmRegister](
              [UserId] [UNIQUEIDENTIFIER] NULL,
              [SortCode] [INT] NOT NULL,
              [Reg_Id] [VARCHAR](MAX) NULL,
              [CheckedIn] [BIT] NOT NULL DEFAULT ((0)),
              [Active] [BIT] NOT NULL DEFAULT ((1))
          )
      END
    `);

    await runQuery("Create HappyHours table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HappyHours]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[HappyHours](
              [PromotionId] [UNIQUEIDENTIFIER] NOT NULL,
              [PromotionCode] [VARCHAR](20) NOT NULL,
              [Description] [VARCHAR](50) NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [FromDate] [SMALLDATETIME] NOT NULL,
              [ToDate] [SMALLDATETIME] NOT NULL,
              [FromTime] [CHAR](10) NULL,
              [ToTime] [CHAR](10) NULL,
              [PromotionDay] [VARCHAR](50) NOT NULL,
              [PromotionPerc] [NUMERIC](18, 2) NOT NULL,
              [PromotionPrice] [NUMERIC](18, 2) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModyfiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModyfiedOn] [DATETIME] NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [PromoType] [CHAR](2) NULL
          )
      END
    `);

    await runQuery("Create HappyHoursLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HappyHoursLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[HappyHoursLog](
              [PromotionId] [UNIQUEIDENTIFIER] NOT NULL,
              [PromotionCode] [VARCHAR](20) NOT NULL,
              [Description] [VARCHAR](50) NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [FromDate] [SMALLDATETIME] NOT NULL,
              [ToDate] [SMALLDATETIME] NOT NULL,
              [FromTime] [CHAR](10) NULL,
              [ToTime] [CHAR](10) NULL,
              [PromotionDay] [VARCHAR](50) NOT NULL,
              [PromotionPerc] [NUMERIC](18, 2) NOT NULL,
              [PromotionPrice] [NUMERIC](18, 2) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModyfiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModyfiedOn] [DATETIME] NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NULL,
              [DeletedUser] [UNIQUEIDENTIFIER] NULL,
              [DeletedDate] [DATETIME] NULL,
              [Falg] [CHAR](1) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create ImageList table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ImageList]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ImageList](
              [Imageid] [UNIQUEIDENTIFIER] NOT NULL,
              [ImageName] [VARCHAR](50) NULL,
              [ImageIcon] [VARCHAR](50) NULL,
              [ImageData] [VARBINARY] NULL
          )
      END
    `);

    await runQuery("Create ImagePath table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ImagePath]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ImagePath](
              [DishId_img] [UNIQUEIDENTIFIER] NULL,
              [DishCode_img] [VARCHAR](20) NULL,
              [Name_img] [NVARCHAR](600) NULL,
              [ImagePath] [VARCHAR](200) NULL
          )
      END
    `);

    await runQuery("Create IngredientMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[IngredientMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[IngredientMaster](
              [IngredientId] [UNIQUEIDENTIFIER] NOT NULL,
              [IngredientCode] [VARCHAR](20) NOT NULL,
              [Name] [VARCHAR](100) NOT NULL,
              [Description] [VARCHAR](100) NULL,
              [UOM] [UNIQUEIDENTIFIER] NOT NULL,
              [IsActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create Inventorymaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Inventorymaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Inventorymaster](
              [InventoryID] [UNIQUEIDENTIFIER] NOT NULL,
              [InventoryCode] [VARCHAR](20) NOT NULL,
              [Description] [NVARCHAR](150) NULL,
              [InventoryGroup] [VARCHAR](20) NULL,
              [BrandId] [UNIQUEIDENTIFIER] NULL,
              [Uom] [VARCHAR](10) NULL,
              [Price] [DECIMAL](18, 4) NULL,
              [GrossCost] [DECIMAL](18, 4) NULL,
              [CurrentCost] [DECIMAL](18, 2) NULL,
              [QuantityOnHand] [DECIMAL](18, 2) NULL,
              [IsActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SordCode] [NUMERIC](10, 2) NULL,
              [ShortName] [VARCHAR](10) NULL,
              [isDiscountAllowed] [BIT] NULL,
              [VendorId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create Invoice table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Invoice]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Invoice](
              [InvoiceId] [UNIQUEIDENTIFIER] NOT NULL,
              [InvoiceNumber] [VARCHAR](20) NOT NULL,
              [Title] [VARCHAR](300) NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL,
              [ContactPerson] [VARCHAR](100) NOT NULL,
              [FunctionDateTime] [DATETIME] NOT NULL,
              [DeliveredOn] [DATETIME] NULL,
              [PaymentTermCode] [INT] NULL,
              [DueDate] [DATETIME] NULL,
              [PriceLevelId] [UNIQUEIDENTIFIER] NULL,
              [IsPriceLocked] [BIT] NULL,
              [Description] [VARCHAR](100) NULL,
              [OperationDescription] [VARCHAR](100) NULL,
              [BillToName] [VARCHAR](200) NULL,
              [BillTo_Line1] [VARCHAR](50) NULL,
              [BillTo_Line2] [VARCHAR](50) NULL,
              [BillTo_Line3] [VARCHAR](50) NULL,
              [BillTo_City] [VARCHAR](50) NULL,
              [BillTo_State] [VARCHAR](50) NULL,
              [BillTo_Country] [VARCHAR](50) NULL,
              [BillTo_PostalCode] [VARCHAR](20) NULL,
              [BillTo_Telephone] [VARCHAR](20) NULL,
              [BillTo_Fax] [VARCHAR](20) NULL,
              [ShippingMethodCode] [INT] NULL,
              [ShipTo_Name] [VARCHAR](200) NULL,
              [ShipTo_Line1] [VARCHAR](50) NULL,
              [ShipTo_Line2] [VARCHAR](50) NULL,
              [ShipTo_Line3] [VARCHAR](50) NULL,
              [ShipTo_City] [VARCHAR](50) NULL,
              [ShipTo_State] [VARCHAR](50) NULL,
              [ShipTo_Country] [VARCHAR](50) NULL,
              [ShipTo_PostalCode] [VARCHAR](20) NULL,
              [ShipTo_Telephone] [VARCHAR](20) NULL,
              [ShipTo_Fax] [VARCHAR](20) NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [CopiedFrom] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create IOSXMLLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[IOSXMLLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[IOSXMLLog](
              [logDate] [DATETIME] NULL,
              [Methodname] [NVARCHAR](100) NULL,
              [paramvalue] [NTEXT] NULL
          )
      END
    `);

    await runQuery("Create ItemMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ItemMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ItemMaster](
              [ItemId] [INT] NOT NULL,
              [ItemName] [NVARCHAR](255) NOT NULL,
              [Price] [DECIMAL](18, 2) NOT NULL DEFAULT ((0)),
              [CategoryName] [NVARCHAR](100) NULL,
              [IsAvailable] [BIT] NULL DEFAULT ((1)),
              [ModifiedOn] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create Kitchen table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Kitchen]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Kitchen](
              [KitchenTypeId] [UNIQUEIDENTIFIER] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [KitchenTypeCode] [NUMERIC](18, 2) NOT NULL,
              [KitchenTypeName] [VARCHAR](100) NOT NULL,
              [isActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create KOTLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[KOTLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[KOTLog](
              [Orderid] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [TotalDetailLineAmount] [NUMERIC](18, 2) NOT NULL,
              [StatusCode] [INT] NOT NULL DEFAULT ((1)),
              [isProcesse] [BIT] NOT NULL DEFAULT ((0)),
              [isReady] [BIT] NOT NULL DEFAULT ((0)),
              [isDelivered] [BIT] NOT NULL DEFAULT ((0)),
              [TerminalCode] [VARCHAR](50) NOT NULL,
              [DeliveredBy] [UNIQUEIDENTIFIER] NOT NULL,
              [DeliveredOn] [DATETIME] NOT NULL
          )
      END
    `);

    await runQuery("Create license table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[license]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[license](
              [license_id] [INT] NOT NULL,
              [license_code] [VARCHAR](50) NOT NULL,
              [license_name] [VARCHAR](100) NOT NULL,
              [FORM_date] [DATE] NOT NULL,
              [LAST_date] [DATE] NOT NULL,
              [STATUS] [VARCHAR](1) NOT NULL DEFAULT ('N'),
              [created_DATE] [DATETIME] NOT NULL DEFAULT (getdate()),
              [CREATED_BY] [VARCHAR](50) NULL,
              [UPDATE_DATE] [DATETIME] NOT NULL DEFAULT (getdate()),
              [UPDATE_BY] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create LiveOrderItemDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LiveOrderItemDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[LiveOrderItemDetail](
              [DetailId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [LiveOrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [LineItemId] [NVARCHAR](100) NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NULL,
              [DishName] [NVARCHAR](255) NULL,
              [Qty] [INT] NULL DEFAULT ((1)),
              [Price] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [Status] [NVARCHAR](50) NULL DEFAULT ('NEW'),
              [SentAt] [DATETIME] NULL,
              [ModifiersJson] [NVARCHAR](MAX) NULL,
              [Note] [NVARCHAR](MAX) NULL,
              [CategoryName] [NVARCHAR](255) NULL
          )
      END
    `);

    await runQuery("Create LiveOrderMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LiveOrderMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[LiveOrderMaster](
              [LiveOrderId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [ContextId] [NVARCHAR](100) NOT NULL,
              [TableId] [UNIQUEIDENTIFIER] NULL,
              [TableNumber] [NVARCHAR](50) NULL,
              [Section] [NVARCHAR](50) NULL,
              [OrderType] [NVARCHAR](50) NULL,
              [TotalAmount] [MONEY] NULL DEFAULT ((0)),
              [DiscountAmount] [MONEY] NULL DEFAULT ((0)),
              [DiscountType] [NVARCHAR](50) NULL,
              [DiscountValue] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [StartTime] [DATETIME] NULL DEFAULT (getdate()),
              [LastUpdated] [DATETIME] NULL DEFAULT (getdate()),
              [Status] [INT] NULL DEFAULT ((1))
          )
      END
    `);

    await runQuery("Create LockedTables table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LockedTables]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[LockedTables](
              [TableId] [NVARCHAR](50) NOT NULL,
              [LockedBy] [NVARCHAR](100) NULL,
              [LockTime] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create LoyaltyCampaign table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LoyaltyCampaign]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[LoyaltyCampaign](
              [CampaignId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [Name] [NVARCHAR](100) NOT NULL,
              [StartDate] [DATETIME] NOT NULL,
              [EndDate] [DATETIME] NOT NULL,
              [IsActive] [BIT] NOT NULL DEFAULT ((1)),
              [CreatedOn] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create LoyaltyCustomer table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LoyaltyCustomer]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[LoyaltyCustomer](
              [LoyaltyCustomerId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [Phone] [NVARCHAR](50) NOT NULL,
              [Name] [NVARCHAR](255) NULL,
              [VisitCount] [INT] NOT NULL DEFAULT ((0)),
              [TotalVisits] [INT] NOT NULL DEFAULT ((0)),
              [RewardsEarned] [INT] NOT NULL DEFAULT ((0)),
              [RewardsRedeemed] [INT] NOT NULL DEFAULT ((0)),
              [RewardPending] [BIT] NOT NULL DEFAULT ((0)),
              [CreatedOn] [DATETIME] NULL DEFAULT (getdate()),
              [LastVisitDate] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create LoyaltyRule table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LoyaltyRule]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[LoyaltyRule](
              [RuleId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [CampaignId] [UNIQUEIDENTIFIER] NOT NULL,
              [LoyaltyType] [NVARCHAR](50) NOT NULL DEFAULT ('Dish'),
              [PurchaseDishId] [UNIQUEIDENTIFIER] NULL,
              [PurchaseDishGroupId] [UNIQUEIDENTIFIER] NULL,
              [RewardDishId] [UNIQUEIDENTIFIER] NULL,
              [RewardDishGroupId] [UNIQUEIDENTIFIER] NULL,
              [RequiredBills] [INT] NOT NULL DEFAULT ((1)),
              [IsActive] [BIT] NOT NULL DEFAULT ((1)),
              [CreatedOn] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create LoyaltyVisit table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LoyaltyVisit]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[LoyaltyVisit](
              [LoyaltyVisitId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [LoyaltyCustomerId] [UNIQUEIDENTIFIER] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NOT NULL,
              [BillNo] [NVARCHAR](50) NOT NULL,
              [VisitDate] [DATETIME] NULL DEFAULT (getdate()),
              [IsRewardVisit] [BIT] NOT NULL DEFAULT ((0)),
              [RewardDishId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create Mas_PostalCode table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Mas_PostalCode]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Mas_PostalCode](
              [Postcode] [VARCHAR](20) NULL,
              [Street] [VARCHAR](200) NULL,
              [Block] [VARCHAR](100) NULL,
              [Country] [VARCHAR](100) NULL,
              [BuildingName] [VARCHAR](100) NOT NULL
          )
      END
    `);

    await runQuery("Create MasterSettings table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MasterSettings]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[MasterSettings](
              [AutoNumber] [INT] NOT NULL,
              [ParamCode] [VARCHAR](30) NOT NULL,
              [Description] [VARCHAR](100) NULL,
              [ParamValueType] [CHAR](1) NOT NULL,
              [ParamStringValue] [VARCHAR](100) NULL,
              [ParamBitValue] [BIT] NULL,
              [ParamGuidValue] [UNIQUEIDENTIFIER] NULL,
              [ParamNumericValue] [NUMERIC](18, 2) NULL,
              [isUserColumn] [BIT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create MemberMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MemberMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[MemberMaster](
              [MemberId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [Name] [NVARCHAR](255) NULL,
              [Phone] [NVARCHAR](20) NULL,
              [Email] [NVARCHAR](255) NULL,
              [CreditLimit] [DECIMAL](18, 2) NULL DEFAULT ((1000)),
              [CreatedAt] [DATETIME] NULL DEFAULT (getdate()),
              [Address] [VARCHAR](255) NULL,
              [IsActive] [BIT] NULL DEFAULT ((1)),
              [Balance] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [CurrentBalance] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedDate] [DATETIME] NULL,
              [LowBalanceAlertSent] [BIT] NOT NULL DEFAULT ((0)),
              [Promocode] [NVARCHAR](100) NULL,
              [Promoamount] [DECIMAL](18, 2) NULL,
              [RewardCredit] [DECIMAL](18, 4) NOT NULL DEFAULT ((0)),
              [AvailableCredit] [DECIMAL](22, 4) NULL,
              [IsVIP] [BIT] NULL DEFAULT ((0)),
              [VIPType] [VARCHAR](20) NULL DEFAULT ('Manual'),
              [VIPSince] [DATETIME] NULL,
              [LifetimeSpend] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [Password] [NVARCHAR](255) NULL
          )
      END
    `);

    await runQuery("Create MemberTimeLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MemberTimeLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[MemberTimeLog](
              [LogId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [MemberId] [UNIQUEIDENTIFIER] NOT NULL,
              [BreakInTime] [DATETIME] NOT NULL,
              [BreakOutTime] [DATETIME] NULL,
              [CreatedAt] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create MisInvoice table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MisInvoice]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[MisInvoice](
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [InvAmt] [DECIMAL](18, 2) NULL,
              [PayAmt] [DECIMAL](38, 2) NULL
          )
      END
    `);

    await runQuery("Create ModifierMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ModifierMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ModifierMaster](
              [ModifierID] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierCode] [VARCHAR](20) NOT NULL,
              [ModifierName] [NVARCHAR](300) NULL,
              [ConflictId] [UNIQUEIDENTIFIER] NULL,
              [isActive] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [SortCode] [INT] NULL,
              [isPriceAffect] [BIT] NULL,
              [isDishPrice] [BIT] NULL,
              [DishCost] [DECIMAL](18, 2) NULL,
              [isOpenModifier] [BIT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create ModifySettlementDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ModifySettlementDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ModifySettlementDetail](
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [Paymode] [VARCHAR](50) NULL,
              [SysAmount] [MONEY] NULL,
              [ManualAmount] [MONEY] NULL,
              [SortageOrExces] [MONEY] NULL
          )
      END
    `);

    await runQuery("Create ModifySettlementTotalSales table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ModifySettlementTotalSales]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ModifySettlementTotalSales](
              [SettlementID] [UNIQUEIDENTIFIER] NOT NULL,
              [PayMode] [VARCHAR](20) NOT NULL,
              [SysAmount] [MONEY] NOT NULL,
              [ManualAmount] [MONEY] NOT NULL,
              [AmountDiff] [MONEY] NOT NULL
          )
      END
    `);

    await runQuery("Create OpeningCashDenomination table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[OpeningCashDenomination]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[OpeningCashDenomination](
              [Id] [INT] NOT NULL,
              [CurrencyValue] [DECIMAL](18, 2) NULL,
              [NoteCount] [INT] NULL,
              [Type] [NVARCHAR](50) NULL,
              [CreatedBy] [NVARCHAR](100) NULL,
              [CreatedOn] [DATETIME] NULL,
              [ScreenType] [VARCHAR](5) NULL,
              [start_date] [DATE] NULL
          )
      END
    `);

    await runQuery("Create Order table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Order]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Order](
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderNumber] [VARCHAR](20) NOT NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [BookingId] [UNIQUEIDENTIFIER] NULL,
              [Title] [VARCHAR](300) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL,
              [ContactPerson] [VARCHAR](100) NOT NULL,
              [FunctionDateTime] [DATETIME] NOT NULL,
              [DateFullfilled] [DATETIME] NULL,
              [PaymentTermCode] [INT] NULL,
              [PriceLevelId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [OperationDescription] [VARCHAR](100) NULL,
              [BillToName] [VARCHAR](200) NULL,
              [BillTo_Line1] [VARCHAR](50) NULL,
              [BillTo_Line2] [VARCHAR](50) NULL,
              [BillTo_Line3] [VARCHAR](50) NULL,
              [BillTo_City] [VARCHAR](50) NULL,
              [BillTo_State] [VARCHAR](50) NULL,
              [BillTo_Country] [VARCHAR](50) NULL,
              [BillTo_PostalCode] [VARCHAR](20) NULL,
              [BillTo_Telephone] [VARCHAR](20) NULL,
              [BillTo_Fax] [VARCHAR](20) NULL,
              [ShippingMethodCode] [INT] NULL,
              [ShipTo_Name] [VARCHAR](200) NULL,
              [ShipTo_Line1] [VARCHAR](50) NULL,
              [ShipTo_Line2] [VARCHAR](50) NULL,
              [ShipTo_Line3] [VARCHAR](50) NULL,
              [ShipTo_City] [VARCHAR](50) NULL,
              [ShipTo_State] [VARCHAR](50) NULL,
              [ShipTo_Country] [VARCHAR](50) NULL,
              [ShipTo_PostalCode] [VARCHAR](20) NULL,
              [ShipTo_Telephone] [VARCHAR](20) NULL,
              [ShipTo_Fax] [VARCHAR](20) NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [CopiedFrom] [UNIQUEIDENTIFIER] NULL,
              [IsPriceLocked] [BIT] NULL,
              [DailyOrderSequenceNumber] [INT] NULL,
              [InformKitchen] [BIT] NULL,
              [IsViewed] [BIT] NULL,
              [PriorityCode] [INT] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TableId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create OrderItemShare table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[OrderItemShare]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[OrderItemShare](
              [Id] [UNIQUEIDENTIFIER] NULL DEFAULT (newid()),
              [OrderDetailId] [UNIQUEIDENTIFIER] NULL,
              [CustomerName] [NVARCHAR](100) NULL,
              [IsSelected] [BIT] NULL DEFAULT ((1)),
              [CreatedDate] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create OrderMergeHistory table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[OrderMergeHistory]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[OrderMergeHistory](
              [MergeId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [ParentOrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [ChildOrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [ParentTableNo] [NVARCHAR](50) NULL,
              [ChildTableNo] [NVARCHAR](50) NULL,
              [MergedAt] [DATETIME] NOT NULL DEFAULT (getdate()),
              [MergedBy] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create OrderSequences table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[OrderSequences]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[OrderSequences](
              [RestaurantId] [UNIQUEIDENTIFIER] NOT NULL,
              [SequenceDate] [DATE] NOT NULL,
              [LastNumber] [INT] NOT NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create Organization table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Organization]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Organization](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [BusinessUnitCode] [VARCHAR](20) NOT NULL,
              [Name] [VARCHAR](150) NOT NULL,
              [Address1_Name] [VARCHAR](200) NULL,
              [Address1_AddressType] [INT] NULL,
              [Address1_Line1] [VARCHAR](50) NULL,
              [Address1_Line2] [VARCHAR](50) NULL,
              [Address1_Line3] [VARCHAR](50) NULL,
              [Address1_City] [VARCHAR](50) NULL,
              [Address1_State] [VARCHAR](50) NULL,
              [Address1_Country] [VARCHAR](50) NULL,
              [Address1_PostalCode] [VARCHAR](20) NULL,
              [Address1_Telephone1] [VARCHAR](20) NULL,
              [Address1_Telephone2] [VARCHAR](20) NULL,
              [Address1_Fax1] [VARCHAR](20) NULL,
              [Address1_Fax2] [VARCHAR](20) NULL,
              [Address1_EmailId1] [VARCHAR](100) NULL,
              [Address1_EmailId2] [VARCHAR](100) NULL,
              [WebSite] [VARCHAR](100) NULL,
              [ParentBusinessUnitid] [UNIQUEIDENTIFIER] NULL,
              [IsActive] [BIT] NULL,
              [BookingPrefix] [VARCHAR](10) NULL,
              [NextBookingNumber] [DECIMAL](18, 2) NOT NULL DEFAULT ((1)),
              [QuotePrefix] [VARCHAR](10) NULL,
              [NextQuoteNumber] [DECIMAL](18, 2) NOT NULL DEFAULT ((1)),
              [OrderPrefix] [VARCHAR](10) NULL,
              [NextOrderNumber] [DECIMAL](18, 2) NOT NULL DEFAULT ((1)),
              [InvoicePrefix] [VARCHAR](10) NULL,
              [NextInvoiceNumber] [DECIMAL](18, 2) NOT NULL DEFAULT ((1)),
              [DoorDeliveryOrderPrefix] [VARCHAR](10) NULL,
              [NextDoorDeliveryOrderNumber] [DECIMAL](18, 2) NOT NULL DEFAULT ((1)),
              [CustomerPreFix] [VARCHAR](10) NULL,
              [NextCustomerNumber] [DECIMAL](18, 2) NULL,
              [UserPrefix] [VARCHAR](10) NULL,
              [NextUserNumber] [DECIMAL](18, 2) NULL,
              [DishPrefix] [VARCHAR](10) NULL,
              [NextDishNumber] [DECIMAL](18, 2) NULL DEFAULT ((1)),
              [WriteInDishPrefix] [VARCHAR](10) NULL,
              [NextWriteInDishNumber] [DECIMAL](18, 2) NULL DEFAULT ((1)),
              [FreeDeliveryAmount] [DECIMAL](18, 2) NULL,
              [DefaultDeliveryCharges] [DECIMAL](18, 2) NULL,
              [GSTPerc] [DECIMAL](18, 2) NULL,
              [DefaultDeliveryInterval] [DECIMAL](18, 2) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [BillPrefix] [VARCHAR](5) NULL,
              [NextBillNumber] [NUMERIC](18, 2) NULL,
              [DishGroupPrefix] [VARCHAR](5) NULL,
              [NextDishGroupNumber] [INT] NULL,
              [isTaxAllowed] [BIT] NULL,
              [GstRegno] [VARCHAR](20) NULL,
              [GstPercentage] [NUMERIC](5, 2) NULL,
              [GstType] [CHAR](1) NULL,
              [MessageOption] [BIT] NULL,
              [BillCopy] [INT] NULL,
              [iskitchenPrint] [BIT] NULL,
              [isOrderPrint] [BIT] NULL,
              [TranPrefix] [VARCHAR](5) NULL,
              [NextTranNumber] [NUMERIC](18, 2) NULL,
              [ModifierPrefix] [VARCHAR](10) NULL,
              [NextModifierNumber] [INT] NULL,
              [MAX_INV_SPLIT] [INT] NULL,
              [isServiceChargeAllowed] [BIT] NULL,
              [ServiceChargePerc] [NUMERIC](10, 2) NULL,
              [TableValidation] [BIT] NULL,
              [ForceModifier] [BIT] NULL,
              [DisplayCode] [BIT] NULL,
              [CheckoutPrint] [BIT] NULL,
              [ReceiptPrint] [BIT] NULL,
              [isPDAAttached] [BIT] NULL,
              [TimerInterval] [NUMERIC](10, 2) NULL,
              [DisplayMessage] [NVARCHAR](4000) NULL,
              [LastUploadHQDate] [DATETIME] NULL,
              [BrandPrefix] [VARCHAR](10) NULL,
              [NextBrandNumber] [DECIMAL](18, 2) NULL,
              [InventoryPrefix] [VARCHAR](10) NULL,
              [NextInventoryNumber] [DECIMAL](18, 2) NULL,
              [PurchasePrefix] [VARCHAR](10) NULL,
              [NextPurchaseNumber] [DECIMAL](18, 2) NULL,
              [CreditPrefix] [VARCHAR](50) NULL,
              [NextCreditNumber] [DECIMAL](18, 2) NULL,
              [ResVersion] [VARCHAR](12) NULL,
              [POSVersion] [VARCHAR](12) NULL,
              [VendorPrefix] [VARCHAR](10) NULL,
              [NextVendorNumber] [INT] NULL,
              [LastArchiveDate] [DATETIME] NULL,
              [PriceListId] [UNIQUEIDENTIFIER] NULL,
              [LocationName] [VARCHAR](50) NULL,
              [LastDownloadDate] [DATETIME] NULL,
              [LastUploadDate] [DATETIME] NULL,
              [isHQ] [BIT] NULL DEFAULT ((0)),
              [isCallerPrinter] [BIT] NULL DEFAULT ((0)),
              [CompanyNameInRcptLine1] [VARCHAR](50) NULL,
              [CompanyNameInRcptLine2] [VARCHAR](50) NULL,
              [ReceiptReport] [BIT] NULL,
              [Logo] [NVARCHAR](MAX) NULL
          )
      END
    `);

    await runQuery("Create ParentDishComboGroupMapping table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ParentDishComboGroupMapping]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ParentDishComboGroupMapping](
              [ParentDishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ComboGroupId] [UNIQUEIDENTIFIER] NOT NULL
          )
      END
    `);

    await runQuery("Create PaymentDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PaymentDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PaymentDetail](
              [PaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [BilledFor] [INT] NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [InvoiceId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NOT NULL,
              [PaymentType] [INT] NOT NULL,
              [Paymode] [INT] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [ReferenceNumber] [VARCHAR](20) NULL,
              [Remarks] [VARCHAR](150) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL,
              [ReturnAmt] [NUMERIC](10, 2) NULL,
              [PayAmount] [NUMERIC](10, 2) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL DEFAULT ((0)),
              [PaymodeServiceChargeAmount] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL DEFAULT ((0)),
              [start_date] [DATE] NULL
          )
      END
    `);

    await runQuery("Create PaymentDetailCur table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PaymentDetailCur]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PaymentDetailCur](
              [PaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [BilledFor] [INT] NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [InvoiceId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NOT NULL,
              [PaymentType] [INT] NOT NULL,
              [Paymode] [INT] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [ReferenceNumber] [VARCHAR](20) NULL,
              [Remarks] [VARCHAR](150) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL,
              [ReturnAmt] [NUMERIC](10, 2) NULL,
              [PayAmount] [NUMERIC](10, 2) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL,
              [PaymodeServiceChargeAmount] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL,
              [start_date] [DATE] NULL
          )
      END
    `);

    await runQuery("Create PaymentDetaillog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PaymentDetaillog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PaymentDetaillog](
              [PaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [BilledFor] [INT] NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [InvoiceId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NOT NULL,
              [PaymentType] [INT] NOT NULL,
              [Paymode] [INT] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [ReferenceNumber] [VARCHAR](20) NULL,
              [Remarks] [VARCHAR](150) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL,
              [ReturnAmt] [NUMERIC](10, 2) NULL,
              [PayAmount] [NUMERIC](10, 2) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL,
              [PaymodeServiceChargeAmount] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL,
              [FromDate] [DATETIME] NULL,
              [ToDate] [DATETIME] NULL,
              [FromPaymode] [VARCHAR](20) NULL,
              [ToPaymode] [VARCHAR](20) NULL,
              [Billnumber] [CHAR](20) NULL
          )
      END
    `);

    await runQuery("Create PaymentGatewayTransactions table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PaymentGatewayTransactions]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PaymentGatewayTransactions](
              [Id] [INT] NOT NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [MemberId] [UNIQUEIDENTIFIER] NULL,
              [PayModeId] [INT] NOT NULL,
              [DeviceSN] [NVARCHAR](100) NOT NULL,
              [RequestPayload] [NVARCHAR](MAX) NULL,
              [ResponsePayload] [NVARCHAR](MAX) NULL,
              [ResponseCode] [INT] NULL,
              [ResponseMsg] [NVARCHAR](500) NULL,
              [Status] [NVARCHAR](20) NULL DEFAULT ('PENDING'),
              [RequestTime] [DATETIME] NULL DEFAULT (getdate()),
              [ResponseTime] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create PaymentTransactionDetails table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PaymentTransactionDetails]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PaymentTransactionDetails](
              [PaymentTransactionId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [ReferenceType] [NVARCHAR](50) NOT NULL,
              [ReferenceId] [UNIQUEIDENTIFIER] NOT NULL,
              [PayModeId] [INT] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [ReferenceNo] [NVARCHAR](100) NULL,
              [CreatedDate] [DATETIME] NOT NULL DEFAULT (getdate()),
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [IsYeahPay] [BIT] NULL DEFAULT ((0)),
              [GatewayResponse] [NVARCHAR](MAX) NULL
          )
      END
    `);

    await runQuery("Create PaymentVoucherDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PaymentVoucherDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PaymentVoucherDetail](
              [PaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [InvoiceId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NOT NULL,
              [VoucherCode] [VARCHAR](10) NOT NULL,
              [VAmount] [DECIMAL](18, 2) NOT NULL,
              [VQty] [DECIMAL](18, 2) NOT NULL,
              [VTotal] [DECIMAL](18, 2) NOT NULL,
              [Remarks] [VARCHAR](150) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL DEFAULT ((0)),
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL DEFAULT ((0)),
              [isUploadHQ] [BIT] NULL
          )
      END
    `);

    await runQuery("Create PaymentVoucherDetailCur table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PaymentVoucherDetailCur]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PaymentVoucherDetailCur](
              [PaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [InvoiceId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NOT NULL,
              [VoucherCode] [VARCHAR](10) NOT NULL,
              [VAmount] [DECIMAL](18, 2) NOT NULL,
              [VQty] [DECIMAL](18, 2) NOT NULL,
              [VTotal] [DECIMAL](18, 2) NOT NULL,
              [Remarks] [VARCHAR](150) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL DEFAULT ((0)),
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL DEFAULT ((0)),
              [isUploadHQ] [BIT] NULL
          )
      END
    `);

    await runQuery("Create Paymode table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Paymode]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Paymode](
              [Position] [DECIMAL](18, 2) NOT NULL,
              [PayMode] [CHAR](50) NULL,
              [Description] [VARCHAR](50) NOT NULL,
              [Commission] [DECIMAL](18, 2) NULL,
              [Active] [BIT] NOT NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [CreateUser] [UNIQUEIDENTIFIER] NULL,
              [CreateDate] [SMALLDATETIME] NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [SMALLDATETIME] NULL,
              [ServiceCharge] [NUMERIC](18, 2) NULL,
              [isEntertainment] [BIT] NULL DEFAULT ((0)),
              [isVoucher] [BIT] NULL DEFAULT ((0)),
              [PaymodeImage] [NVARCHAR](MAX) NULL,
              [DeviceSN] [NVARCHAR](50) NULL,
              [DeviceSalt] [NVARCHAR](100) NULL,
              [YeahPayEnabled] [BIT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create PendingOrders table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PendingOrders]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PendingOrders](
              [OrderId] [VARCHAR](50) NOT NULL,
              [Section] [NVARCHAR](100) NULL,
              [TableNo] [NVARCHAR](50) NULL,
              [OrderType] [NVARCHAR](50) NULL,
              [TakeawayNo] [NVARCHAR](50) NULL,
              [Status] [NVARCHAR](50) NOT NULL DEFAULT ('SENT'),
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [ItemsJson] [NVARCHAR](MAX) NULL,
              [CreatedAt] [DATETIME] NOT NULL DEFAULT (getdate()),
              [UpdatedAt] [DATETIME] NOT NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create PickListMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PickListMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PickListMaster](
              [TableName] [VARCHAR](50) NOT NULL,
              [FieldName] [VARCHAR](100) NOT NULL,
              [PickListNumber] [INT] NOT NULL,
              [PickListValue] [VARCHAR](100) NOT NULL,
              [DisplayOrder] [INT] NOT NULL,
              [IsDefault] [BIT] NULL,
              [isUserTable] [BIT] NULL
          )
      END
    `);

    await runQuery("Create POSFunctions table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[POSFunctions]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[POSFunctions](
              [FunctionId] [UNIQUEIDENTIFIER] NULL,
              [FunctionCode] [VARCHAR](10) NOT NULL,
              [FunctionDescription] [VARCHAR](150) NULL,
              [FunctionGroup] [VARCHAR](20) NULL,
              [SortCode] [INT] NULL
          )
      END
    `);

    await runQuery("Create POSPermission table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[POSPermission]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[POSPermission](
              [CashierID] [UNIQUEIDENTIFIER] NOT NULL,
              [FunctionId] [UNIQUEIDENTIFIER] NOT NULL,
              [Status] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [SMALLDATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [SMALLDATETIME] NULL
          )
      END
    `);

    await runQuery("Create PriceListMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PriceListMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PriceListMaster](
              [PriceListId] [UNIQUEIDENTIFIER] NOT NULL,
              [Name] [VARCHAR](100) NOT NULL,
              [Description] [VARCHAR](100) NULL,
              [BeginDate] [DATETIME] NULL,
              [EndDate] [DATETIME] NULL,
              [IsActive] [BIT] NOT NULL DEFAULT (1),
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SortCode] [INT] NULL,
              [ExpiryDate] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create PrintJobQueue table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PrintJobQueue]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PrintJobQueue](
              [JobId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [StoreId] [NVARCHAR](50) NOT NULL,
              [PrinterName] [NVARCHAR](100) NULL,
              [PrinterIp] [NVARCHAR](100) NOT NULL,
              [PrinterPort] [INT] NOT NULL DEFAULT ((9100)),
              [Content] [NVARCHAR](MAX) NOT NULL,
              [Status] [NVARCHAR](20) NOT NULL DEFAULT ('PENDING'),
              [ErrorMessage] [NVARCHAR](MAX) NULL,
              [CreatedOn] [DATETIME] NOT NULL DEFAULT (getdate()),
              [ProcessedOn] [DATETIME] NULL,
              [CompletedOn] [DATETIME] NULL,
              [Attempts] [INT] NOT NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create PrintMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PrintMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PrintMaster](
              [PrinterId] [UNIQUEIDENTIFIER] NOT NULL,
              [PrinterName] [VARCHAR](50) NOT NULL,
              [PrinterPath] [VARCHAR](100) NOT NULL,
              [PrinterIP] [VARCHAR](50) NOT NULL,
              [PrinterType] [INT] NULL,
              [PrintSection] [INT] NULL,
              [KitchenTypeName] [VARCHAR](50) NULL,
              [KitchenTypeValue] [INT] NULL,
              [IsActive] [BIT] NULL,
              [PrintCopy] [INT] NULL,
              [IsEnabled] [BIT] NOT NULL DEFAULT ((1))
          )
      END
    `);

    await runQuery("Create PrintReport table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PrintReport]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PrintReport](
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [Ordernumber] [VARCHAR](20) NOT NULL,
              [PrintType] [INT] NOT NULL,
              [orderDate] [DATETIME] NOT NULL,
              [isEditOrder] [BIT] NULL,
              [isReprint] [BIT] NULL DEFAULT ((0)),
              [isHold] [BIT] NULL
          )
      END
    `);

    await runQuery("Create PrintReportDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PrintReportDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PrintReportDetail](
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderDetailid] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderNumber] [VARCHAR](50) NOT NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [PrintType] [INT] NULL,
              [isEditOrder] [BIT] NULL
          )
      END
    `);

    await runQuery("Create PurchaseDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PurchaseDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PurchaseDetail](
              [TranId] [UNIQUEIDENTIFIER] NOT NULL,
              [TranNo] [VARCHAR](20) NOT NULL,
              [TranType] [CHAR](6) NOT NULL,
              [ItemCode] [VARCHAR](20) NOT NULL,
              [ItemDesc] [NVARCHAR](200) NULL,
              [BusinessUnitCode] [VARCHAR](15) NULL,
              [PrcCode] [VARCHAR](15) NOT NULL,
              [Uom] [VARCHAR](15) NOT NULL,
              [DeptCode] [VARCHAR](20) NULL,
              [Categorycode] [VARCHAR](15) NULL,
              [Qty] [DECIMAL](18, 3) NOT NULL,
              [UnitPrice] [DECIMAL](18, 4) NOT NULL,
              [Totalamount] [DECIMAL](18, 4) NOT NULL,
              [DetailDiscPerc] [DECIMAL](18, 4) NOT NULL,
              [DetailDiscAmount] [DECIMAL](19, 4) NOT NULL,
              [TotalValue] [DECIMAL](18, 4) NOT NULL,
              [NetDiscAmount] [DECIMAL](19, 4) NOT NULL,
              [TotalDiscAmount] [DECIMAL](19, 4) NULL,
              [NetValue] [DECIMAL](18, 4) NULL,
              [FocQty] [DECIMAL](18, 3) NOT NULL,
              [NetPrice] [DECIMAL](18, 4) NOT NULL,
              [GstPerc] [DECIMAL](18, 2) NOT NULL,
              [GstAmt] [DECIMAL](19, 4) NOT NULL,
              [NetAmount] [DECIMAL](18, 4) NOT NULL,
              [LocationCode] [VARCHAR](50) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifiedOn] [DATETIME] NOT NULL,
              [ItemId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create PurchaseHeader table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PurchaseHeader]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[PurchaseHeader](
              [TranId] [UNIQUEIDENTIFIER] NOT NULL,
              [TranNo] [VARCHAR](50) NOT NULL,
              [Trandate] [DATETIME] NOT NULL,
              [TranType] [CHAR](6) NOT NULL,
              [PurchaseOrderNo] [VARCHAR](50) NULL,
              [SupplierId] [UNIQUEIDENTIFIER] NOT NULL,
              [SupplierName] [VARCHAR](100) NOT NULL,
              [VendorInvoiceNo] [VARCHAR](20) NULL,
              [VendorInvoiceDate] [DATETIME] NULL,
              [VendorDueDate] [DATETIME] NULL,
              [Totalamount] [MONEY] NULL,
              [DetailDisc] [MONEY] NULL,
              [TotalValue] [MONEY] NULL,
              [NetDiscPerc] [NUMERIC](18, 2) NULL,
              [NetDiscAmt] [MONEY] NULL,
              [TotalDiscAmt] [MONEY] NULL,
              [NetValue] [MONEY] NULL,
              [GstAmount] [MONEY] NULL,
              [NetAmount] [MONEY] NULL,
              [BusinessUnitcode] [VARCHAR](20) NOT NULL,
              [Remarks] [VARCHAR](50) NULL,
              [Processed] [CHAR](1) NULL,
              [Approved] [CHAR](1) NULL,
              [Cancelled] [CHAR](1) NULL,
              [CurrCode] [CHAR](3) NULL,
              [CurrRate] [SMALLMONEY] NULL,
              [GstType] [CHAR](1) NULL,
              [ForeignCurrencyCode] [VARCHAR](50) NULL,
              [ForeigncurrencyRate] [DECIMAL](18, 2) NULL,
              [LocationCode] [VARCHAR](10) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [GSTPercentage] [NUMERIC](18, 2) NULL
          )
      END
    `);

    await runQuery("Create QOIDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[QOIDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[QOIDetail](
              [QOIDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [InvoiceId] [UNIQUEIDENTIFIER] NULL,
              [AssociatedQOIDetailId] [UNIQUEIDENTIFIER] NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Discription] [VARCHAR](150) NOT NULL,
              [MenuLabel] [VARCHAR](50) NULL,
              [FunctionDateTime] [DATETIME] NULL,
              [Quantity] [DECIMAL](18, 2) NOT NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [CookingQuantity] [DECIMAL](18, 2) NULL,
              [CookingUOM] [INT] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create QOIEquipment table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[QOIEquipment]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[QOIEquipment](
              [QOIEquipmentId] [UNIQUEIDENTIFIER] NOT NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [InvoiceId] [UNIQUEIDENTIFIER] NULL,
              [EquipmentFor] [INT] NOT NULL,
              [EquipmentId] [UNIQUEIDENTIFIER] NOT NULL,
              [Quantity] [DECIMAL](18, 2) NOT NULL,
              [UnitRate] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NOT NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NOT NULL,
              [StatusCode] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create QOIMenuDish table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[QOIMenuDish]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[QOIMenuDish](
              [QOIMenuDishId] [UNIQUEIDENTIFIER] NOT NULL,
              [QOIDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [CookingQuantity] [DECIMAL](18, 2) NOT NULL,
              [CookingUOM] [INT] NOT NULL,
              [StatusCode] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create QRMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[QRMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[QRMaster](
              [Id] [INT] NOT NULL,
              [TableNo] [VARCHAR](100) NULL,
              [QRCode] [VARCHAR](MAX) NULL,
              [QRLink] [VARCHAR](500) NULL
          )
      END
    `);

    await runQuery("Create QueryTable table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[QueryTable]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[QueryTable](
              [BusinessunitId] [UNIQUEIDENTIFIER] NOT NULL,
              [QueryDate] [DATETIME] NOT NULL,
              [QueryString] [NTEXT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [IsExec] [BIT] NULL,
              [IsHQFlag] [BIT] NULL,
              [FromDate] [DATETIME] NULL,
              [ToDate] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create Quote table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Quote]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Quote](
              [QuoteId] [UNIQUEIDENTIFIER] NOT NULL,
              [QuoteNumber] [VARCHAR](20) NOT NULL,
              [Title] [VARCHAR](300) NOT NULL,
              [RevisionNumber] [INT] NOT NULL DEFAULT (0),
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL,
              [ContactPerson] [VARCHAR](100) NOT NULL,
              [NoOfHeads] [INT] NULL,
              [FunctionDateTime] [DATETIME] NOT NULL,
              [EffectiveFrom] [DATETIME] NULL,
              [EffectiveTo] [DATETIME] NULL,
              [ExpiresOn] [DATETIME] NULL,
              [ConfirmedOn] [DATETIME] NULL,
              [PaymentTermCode] [INT] NULL,
              [PriceLevelId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [OperationDescription] [VARCHAR](100) NULL,
              [BillToName] [VARCHAR](200) NULL,
              [BillTo_Line1] [VARCHAR](50) NULL,
              [BillTo_Line2] [VARCHAR](50) NULL,
              [BillTo_Line3] [VARCHAR](50) NULL,
              [BillTo_City] [VARCHAR](50) NULL,
              [BillTo_State] [VARCHAR](50) NULL,
              [BillTo_Country] [VARCHAR](50) NULL,
              [BillTo_PostalCode] [VARCHAR](20) NULL,
              [BillTo_Telephone] [VARCHAR](20) NULL,
              [BillTo_Fax] [VARCHAR](20) NULL,
              [ShippingMethodCode] [INT] NULL,
              [ShipTo_Name] [VARCHAR](200) NULL,
              [ShipTo_Line1] [VARCHAR](50) NULL,
              [ShipTo_Line2] [VARCHAR](50) NULL,
              [ShipTo_Line3] [VARCHAR](50) NULL,
              [ShipTo_City] [VARCHAR](50) NULL,
              [ShipTo_State] [VARCHAR](50) NULL,
              [ShipTo_Country] [VARCHAR](50) NULL,
              [ShipTo_PostalCode] [VARCHAR](20) NULL,
              [ShipTo_Telephone] [VARCHAR](20) NULL,
              [ShipTo_Fax] [VARCHAR](20) NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [CopiedFrom] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create ReceiptPrintCache table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReceiptPrintCache]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ReceiptPrintCache](
              [Id] [INT] NOT NULL,
              [BillNo] [NVARCHAR](100) NOT NULL,
              [ReceiptJSON] [NVARCHAR](MAX) NOT NULL,
              [DiscountJSON] [NVARCHAR](MAX) NULL,
              [CreatedAt] [DATETIME] NOT NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create ReportHeader table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReportHeader]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ReportHeader](
              [ReportName] [VARCHAR](100) NOT NULL,
              [PaperSize] [VARCHAR](50) NOT NULL,
              [PageOrientation] [VARCHAR](50) NOT NULL,
              [Remarks] [VARCHAR](100) NULL,
              [ReportQuery] [NTEXT] NULL,
              [SortCode] [INT] NULL
          )
      END
    `);

    await runQuery("Create ReportList table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReportList]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ReportList](
              [ReportName] [VARCHAR](300) NULL
          )
      END
    `);

    await runQuery("Create req_save table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[req_save]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[req_save](
              [sno] [NUMERIC](18, 2) NULL,
              [request] [VARCHAR](MAX) NULL
          )
      END
    `);

    await runQuery("Create ResourceBookingDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ResourceBookingDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ResourceBookingDetail](
              [BookingDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [BookingId] [UNIQUEIDENTIFIER] NOT NULL,
              [ResourceType] [INT] NOT NULL,
              [ResourceId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create ResourceBookingHeader table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ResourceBookingHeader]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ResourceBookingHeader](
              [BookingId] [UNIQUEIDENTIFIER] NOT NULL,
              [BookingNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL,
              [Description] [VARCHAR](150) NULL,
              [EventStartTime] [DATETIME] NOT NULL,
              [EventEndTime] [DATETIME] NOT NULL,
              [ScheduleDurationInMins] [INT] NOT NULL,
              [ActualStartTime] [DATETIME] NULL,
              [ActualEndTime] [DATETIME] NULL,
              [AtualDurationInMins] [INT] NULL,
              [LocationId] [UNIQUEIDENTIFIER] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [IsAllDayEvent] [BIT] NOT NULL,
              [IsBilled] [BIT] NOT NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create RestaurantInvoice table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantInvoice]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantInvoice](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [BillNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [TimeBilled] [DATETIME] NULL,
              [PaymentTermCode] [INT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [InvoiceDate] [SMALLDATETIME] NULL,
              [MergeCount] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [SplitCount] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [isUploadHQ] [BIT] NULL DEFAULT ((0)),
              [DiscountId] [UNIQUEIDENTIFIER] NULL,
              [PartialPaid] [BIT] NULL DEFAULT ((0)),
              [DiscountRemarks] [VARCHAR](1000) NULL,
              [AdditionalServiceCharge] [DECIMAL](18, 4) NULL DEFAULT ((0)),
              [Pax] [INT] NULL,
              [start_date] [DATE] NULL
          )
      END
    `);

    await runQuery("Create RestaurantInvoiceCur table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantInvoiceCur]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantInvoiceCur](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [BillNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [TimeBilled] [DATETIME] NULL,
              [PaymentTermCode] [INT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [InvoiceDate] [SMALLDATETIME] NULL,
              [MergeCount] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [SplitCount] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [isUploadHQ] [BIT] NULL DEFAULT ((0)),
              [DiscountId] [UNIQUEIDENTIFIER] NULL,
              [PartialPaid] [BIT] NULL DEFAULT ((0)),
              [DiscountRemarks] [VARCHAR](1000) NULL,
              [AdditionalServiceCharge] [DECIMAL](18, 4) NULL DEFAULT ((0)),
              [Pax] [INT] NULL,
              [start_date] [DATE] NULL
          )
      END
    `);

    await runQuery("Create RestaurantInvoiceLog table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantInvoiceLog]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantInvoiceLog](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [BillNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [TimeBilled] [DATETIME] NULL,
              [PaymentTermCode] [INT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [InvoiceDate] [SMALLDATETIME] NULL,
              [MergeCount] [NUMERIC](18, 2) NULL,
              [SplitCount] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL,
              [DiscountId] [UNIQUEIDENTIFIER] NULL,
              [PartialPaid] [BIT] NULL,
              [DiscountRemarks] [VARCHAR](1000) NULL,
              [AdditionalServiceCharge] [NUMERIC](18, 4) NULL,
              [Mode] [VARCHAR](10) NULL,
              [DeletedUser] [UNIQUEIDENTIFIER] NULL,
              [DeletedDate] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create RestaurantModifierDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantModifierDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantModifierDetail](
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [Quantity] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [ModifierName] [NVARCHAR](800) NULL,
              [Amount] [DECIMAL](18, 2) NULL,
              [Description] [NVARCHAR](100) NULL,
              [START_DATE] [DATE] NULL
          )
      END
    `);

    await runQuery("Create RestaurantModifierDetailCur table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantModifierDetailCur]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantModifierDetailCur](
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [Quantity] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [ModifierName] [NVARCHAR](800) NULL,
              [Description] [NVARCHAR](100) NULL,
              [Amount] [DECIMAL](18, 2) NULL,
              [START_DATE] [DATE] NULL
          )
      END
    `);

    await runQuery("Create RestaurantOrder table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantOrder]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantOrder](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [OrderEntryUnit] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [Tableno] [CHAR](10) NULL,
              [Persons] [NUMERIC](18, 2) NULL,
              [TimeBilled] [DATETIME] NULL,
              [PriceListId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [DailyOrderSequenceNumber] [INT] NULL,
              [InformedKitchen] [BIT] NULL,
              [IsTakeAway] [BIT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [PriorityCode] [INT] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [isOrderClosed] [BIT] NOT NULL DEFAULT ((0)),
              [isCourse1Fired] [BIT] NULL DEFAULT ((0)),
              [isCourse2Fired] [BIT] NULL DEFAULT ((0)),
              [isMainCourseFired] [BIT] NULL DEFAULT ((0)),
              [isDessertsFired] [BIT] NULL DEFAULT ((0)),
              [isGuestMeal] [BIT] NULL,
              [isUploadHQ] [BIT] NULL DEFAULT ((0)),
              [DiscountId] [UNIQUEIDENTIFIER] NULL,
              [SourceTable] [VARCHAR](10) NULL,
              [DiscountRemarks] [VARCHAR](1000) NULL,
              [AdditionalServiceCharge] [DECIMAL](18, 4) NULL DEFAULT ((0)),
              [MobileNo] [NVARCHAR](50) NULL,
              [START_DATE] [DATE] NULL,
              [TakeawayCharge] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [TakeawayChargeOverride] [INT] NULL DEFAULT ((0)),
              [ServiceChargeOverride] [INT] NULL DEFAULT ((0)),
              [ClientOrderID] [VARCHAR](100) NULL
          )
      END
    `);

    await runQuery("Create RestaurantOrderCur table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantOrderCur]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantOrderCur](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [OrderEntryUnit] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [Tableno] [CHAR](10) NULL,
              [Persons] [NUMERIC](18, 2) NULL,
              [TimeBilled] [DATETIME] NULL,
              [PriceListId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [DailyOrderSequenceNumber] [INT] NULL,
              [InformedKitchen] [BIT] NULL,
              [IsTakeAway] [BIT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [PriorityCode] [INT] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [isOrderClosed] [BIT] NOT NULL DEFAULT ((0)),
              [isCourse1Fired] [BIT] NULL DEFAULT ((0)),
              [isCourse2Fired] [BIT] NULL DEFAULT ((0)),
              [isMainCourseFired] [BIT] NULL DEFAULT ((0)),
              [isDessertsFired] [BIT] NULL DEFAULT ((0)),
              [isGuestMeal] [BIT] NULL DEFAULT ((0)),
              [isUploadHQ] [BIT] NULL,
              [DiscountId] [UNIQUEIDENTIFIER] NULL,
              [SourceTable] [VARCHAR](10) NULL,
              [DiscountRemarks] [VARCHAR](1000) NULL,
              [AdditionalServiceCharge] [DECIMAL](18, 4) NULL DEFAULT ((0)),
              [MobileNo] [NVARCHAR](50) NULL,
              [Pax] [INT] NULL,
              [CustomerName] [NVARCHAR](9) NULL,
              [START_DATE] [DATE] NULL,
              [ServiceChargeOverride] [BIT] NULL,
              [TakeawayCharge] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [TakeawayChargeOverride] [INT] NULL DEFAULT ((0)),
              [ClientOrderID] [VARCHAR](100) NULL
          )
      END
    `);

    await runQuery("Create RestaurantOrderCurtEMP table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantOrderCurtEMP]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantOrderCurtEMP](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [OrderEntryUnit] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [Tableno] [CHAR](10) NULL,
              [Persons] [NUMERIC](18, 2) NULL,
              [TimeBilled] [DATETIME] NULL,
              [PriceListId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [DailyOrderSequenceNumber] [INT] NULL,
              [InformedKitchen] [BIT] NULL,
              [IsTakeAway] [BIT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [PriorityCode] [INT] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [isOrderClosed] [BIT] NOT NULL,
              [isCourse1Fired] [BIT] NULL,
              [isCourse2Fired] [BIT] NULL,
              [isMainCourseFired] [BIT] NULL,
              [isDessertsFired] [BIT] NULL,
              [isGuestMeal] [BIT] NULL,
              [isUploadHQ] [BIT] NULL,
              [DiscountId] [UNIQUEIDENTIFIER] NULL,
              [SourceTable] [VARCHAR](10) NULL,
              [DiscountRemarks] [VARCHAR](1000) NULL,
              [AdditionalServiceCharge] [DECIMAL](18, 4) NULL
          )
      END
    `);

    await runQuery("Create RestaurantOrderDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantOrderDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantOrderDetail](
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Description] [NVARCHAR](500) NOT NULL,
              [Quantity] [DECIMAL](18, 3) NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [AssociatedDishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SeqNo] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [isTakeAway] [BIT] NULL DEFAULT ((0)),
              [DishName] [NVARCHAR](150) NULL DEFAULT (''),
              [ActualAmount] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [Tax] [NUMERIC](18, 4) NULL DEFAULT ((0)),
              [ServiceCharge] [NUMERIC](18, 4) NULL DEFAULT ((0)),
              [PFlag] [CHAR](1) NULL,
              [ModifierDescription] [NVARCHAR](300) NULL,
              [Remarks] [VARCHAR](300) NULL,
              [ExFlag] [CHAR](1) NULL,
              [IsODFOC] [INT] NULL,
              [IsODItemDiscount] [INT] NULL,
              [isstandardMenu] [BIT] NULL DEFAULT ((0)),
              [Pcs] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [isProcesse] [BIT] NULL,
              [isReady] [BIT] NULL,
              [isDelivered] [BIT] NULL,
              [Spicy] [NVARCHAR](50) NULL,
              [Salt] [NVARCHAR](50) NULL,
              [Oil] [NVARCHAR](50) NULL,
              [Sugar] [NVARCHAR](50) NULL,
              [OrderConfirmQty] [INT] NULL DEFAULT ((0)),
              [VoidReason] [NVARCHAR](MAX) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountType] [NVARCHAR](20) NULL,
              [SongName] [NVARCHAR](200) NULL,
              [START_DATE] [DATE] NULL,
              [ComboDetailsJSON] [NVARCHAR](MAX) NULL,
              [TakeawayCharge] [DECIMAL](18, 2) NULL,
              [ClientItemID] [VARCHAR](100) NULL
          )
      END
    `);

    await runQuery("Create RestaurantOrderDetailCur table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantOrderDetailCur]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantOrderDetailCur](
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Description] [NVARCHAR](500) NOT NULL,
              [Quantity] [DECIMAL](18, 3) NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [AssociatedDishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SeqNo] [NUMERIC](18, 2) NULL,
              [isTakeAway] [BIT] NULL,
              [DishName] [NVARCHAR](150) NULL,
              [ActualAmount] [NUMERIC](18, 2) NULL,
              [Tax] [NUMERIC](18, 4) NULL,
              [ServiceCharge] [NUMERIC](18, 4) NULL,
              [PFlag] [CHAR](1) NULL,
              [ModifierDescription] [NVARCHAR](300) NULL,
              [Remarks] [VARCHAR](300) NULL,
              [ExFlag] [CHAR](1) NULL,
              [IsODFOC] [INT] NULL,
              [IsODItemDiscount] [INT] NULL,
              [isstandardMenu] [BIT] NULL DEFAULT ((0)),
              [Pcs] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [isProcesse] [BIT] NULL,
              [isReady] [BIT] NULL,
              [isDelivered] [BIT] NULL,
              [Spicy] [NVARCHAR](50) NULL,
              [Salt] [NVARCHAR](50) NULL,
              [Oil] [NVARCHAR](50) NULL,
              [Sugar] [NVARCHAR](50) NULL,
              [OrderConfirmQty] [INT] NULL DEFAULT ((0)),
              [VoidReason] [NVARCHAR](MAX) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountType] [NVARCHAR](20) NULL,
              [ModifiersJSON] [NVARCHAR](MAX) NULL,
              [OrderNumber] [NVARCHAR](100) NULL,
              [SongName] [NVARCHAR](200) NULL,
              [isSettlement] [BIT] NULL DEFAULT ((0)),
              [START_DATE] [DATE] NULL,
              [ComboDetailsJSON] [NVARCHAR](MAX) NULL,
              [AcceptedOn] [DATETIME] NULL,
              [ReadyOn] [DATETIME] NULL,
              [ServedOn] [DATETIME] NULL,
              [TakeawayCharge] [DECIMAL](18, 2) NULL,
              [ClientItemID] [VARCHAR](100) NULL
          )
      END
    `);

    await runQuery("Create RestaurantOrderMenuDish table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantOrderMenuDish]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantOrderMenuDish](
              [RestaurantOrderMenuDishId] [UNIQUEIDENTIFIER] NOT NULL,
              [RestaurantOrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [StatusCode] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create RestaurantSelfOrderCur table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantSelfOrderCur]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantSelfOrderCur](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [OrderEntryUnit] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [Tableno] [CHAR](10) NULL,
              [Persons] [NUMERIC](18, 2) NULL,
              [TimeBilled] [DATETIME] NULL,
              [PriceListId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [DailyOrderSequenceNumber] [INT] NULL,
              [InformedKitchen] [BIT] NULL,
              [IsTakeAway] [BIT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [PriorityCode] [INT] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [isOrderClosed] [BIT] NOT NULL DEFAULT ((0)),
              [isCourse1Fired] [BIT] NULL DEFAULT ((0)),
              [isCourse2Fired] [BIT] NULL DEFAULT ((0)),
              [isMainCourseFired] [BIT] NULL DEFAULT ((0)),
              [isDessertsFired] [BIT] NULL DEFAULT ((0)),
              [isGuestMeal] [BIT] NULL DEFAULT ((0)),
              [isUploadHQ] [BIT] NULL,
              [DiscountId] [UNIQUEIDENTIFIER] NULL,
              [SourceTable] [VARCHAR](10) NULL,
              [DiscountRemarks] [VARCHAR](1000) NULL,
              [AdditionalServiceCharge] [DECIMAL](18, 4) NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create RestaurantSelfOrderDetailCur table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RestaurantSelfOrderDetailCur]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RestaurantSelfOrderDetailCur](
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Description] [NVARCHAR](500) NOT NULL,
              [Quantity] [DECIMAL](18, 3) NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [AssociatedDishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SeqNo] [NUMERIC](18, 2) NULL,
              [isTakeAway] [BIT] NULL,
              [DishName] [NVARCHAR](150) NULL,
              [ActualAmount] [NUMERIC](18, 2) NULL,
              [Tax] [NUMERIC](18, 4) NULL,
              [ServiceCharge] [NUMERIC](18, 4) NULL,
              [PFlag] [CHAR](1) NULL,
              [ModifierDescription] [NVARCHAR](300) NULL,
              [Remarks] [VARCHAR](300) NULL,
              [ExFlag] [CHAR](1) NULL,
              [IsODFOC] [INT] NULL,
              [IsODItemDiscount] [INT] NULL,
              [isstandardMenu] [BIT] NULL DEFAULT ((0)),
              [Pcs] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [isProcesse] [BIT] NULL,
              [isReady] [BIT] NULL,
              [isDelivered] [BIT] NULL
          )
      END
    `);

    await runQuery("Create RewardMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RewardMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RewardMaster](
              [Id] [INT] NOT NULL,
              [SpendAmount] [DECIMAL](18, 2) NOT NULL,
              [CreditAmount] [DECIMAL](18, 2) NOT NULL,
              [IsActive] [BIT] NOT NULL DEFAULT ((1)),
              [CreatedOn] [DATETIME] NOT NULL DEFAULT (getdate()),
              [Description] [NVARCHAR](255) NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create RewardPointDetails table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RewardPointDetails]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RewardPointDetails](
              [Id] [UNIQUEIDENTIFIER] NOT NULL,
              [Denomination] [DECIMAL](18, 2) NULL,
              [PointsUsage] [DECIMAL](18, 2) NULL,
              [FromDate] [SMALLDATETIME] NULL,
              [ToDate] [SMALLDATETIME] NULL,
              [CreateUser] [UNIQUEIDENTIFIER] NULL,
              [CreateDate] [SMALLDATETIME] NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [SMALLDATETIME] NULL,
              [Amount] [DECIMAL](18, 2) NULL,
              [Discount] [DECIMAL](18, 2) NULL,
              [DefaultDisc] [DECIMAL](18, 2) NULL,
              [DefaultPoint] [DECIMAL](18, 2) NULL,
              [TransType] [VARCHAR](20) NULL,
              [PointsUsed] [DECIMAL](18, 4) NOT NULL DEFAULT ((0)),
              [MemberId] [UNIQUEIDENTIFIER] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [BillNo] [NVARCHAR](100) NULL,
              [BillAmount] [DECIMAL](18, 4) NULL DEFAULT ((0)),
              [PointsEarned] [DECIMAL](18, 4) NOT NULL DEFAULT ((0)),
              [PayMode] [NVARCHAR](50) NULL,
              [Remarks] [NVARCHAR](500) NULL,
              [CreatedOn] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create RewardPointsRedemption table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RewardPointsRedemption]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[RewardPointsRedemption](
              [CustomerCode] [VARCHAR](50) NOT NULL,
              [InvoiceNo] [VARCHAR](50) NOT NULL,
              [InvoicDate] [VARCHAR](50) NOT NULL,
              [PointsBefore] [NUMERIC](18, 2) NOT NULL,
              [UsagePoints] [NUMERIC](18, 2) NOT NULL,
              [PointsAfter] [NUMERIC](18, 2) NULL,
              [BussinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModyfiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModyfiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create Route table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Route]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Route](
              [RouteId] [UNIQUEIDENTIFIER] NOT NULL,
              [RouteCode] [VARCHAR](50) NOT NULL,
              [RouteName] [VARCHAR](50) NULL,
              [Description] [VARCHAR](100) NULL,
              [isActive] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create server table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[server]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[server](
              [SER_ID] [INT] NOT NULL,
              [SER_NAME] [VARCHAR](255) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedDate] [DATETIME] NULL DEFAULT (getdate()),
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedDate] [DATETIME] NULL,
              [Activeflag] [BIT] NULL
          )
      END
    `);

    await runQuery("Create servermaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[servermaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[servermaster](
              [ID] [INT] NOT NULL,
              [SER_ID] [INT] NOT NULL,
              [SER_NAME] [NVARCHAR](255) NULL,
              [TableNo] [NVARCHAR](50) NULL,
              [OrderId] [NVARCHAR](50) NULL,
              [Section] [NVARCHAR](100) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedDate] [DATETIME] NULL DEFAULT (getdate()),
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedDate] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create ServiceAssignmentHistory table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ServiceAssignmentHistory]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ServiceAssignmentHistory](
              [Id] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [RequestId] [UNIQUEIDENTIFIER] NOT NULL,
              [OldStaffId] [UNIQUEIDENTIFIER] NULL,
              [OldStaffName] [VARCHAR](100) NULL,
              [NewStaffId] [UNIQUEIDENTIFIER] NULL,
              [NewStaffName] [VARCHAR](100) NULL,
              [TransferredBy] [VARCHAR](100) NULL,
              [TransferredAt] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create ServiceRequest table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ServiceRequest]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ServiceRequest](
              [Id] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [VARCHAR](100) NULL,
              [TableId] [VARCHAR](100) NULL,
              [SectionId] [VARCHAR](100) NULL,
              [ServiceMode] [INT] NULL DEFAULT ((1)),
              [Priority] [VARCHAR](50) NULL DEFAULT ('Normal'),
              [Status] [VARCHAR](50) NULL DEFAULT ('NEW'),
              [AssignedStaffId] [UNIQUEIDENTIFIER] NULL,
              [AssignedStaffName] [VARCHAR](100) NULL,
              [CreatedAt] [DATETIME] NULL DEFAULT (getdate()),
              [AcceptedAt] [DATETIME] NULL,
              [ReadyAt] [DATETIME] NULL,
              [DeliveredAt] [DATETIME] NULL,
              [CompletedAt] [DATETIME] NULL,
              [PauseAt] [DATETIME] NULL,
              [ResumeAt] [DATETIME] NULL,
              [DelayReason] [VARCHAR](255) NULL,
              [PauseReason] [VARCHAR](255) NULL,
              [Remarks] [VARCHAR](255) NULL,
              [CreatedBy] [VARCHAR](100) NULL,
              [AcceptedBy] [VARCHAR](100) NULL,
              [CompletedBy] [VARCHAR](100) NULL,
              [QueueNumber] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create ServiceRequestItems table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ServiceRequestItems]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ServiceRequestItems](
              [Id] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [RequestId] [UNIQUEIDENTIFIER] NOT NULL,
              [Department] [VARCHAR](100) NULL,
              [ItemId] [VARCHAR](100) NULL,
              [ItemName] [VARCHAR](255) NULL,
              [Qty] [DECIMAL](18, 2) NULL DEFAULT ((1)),
              [Status] [VARCHAR](50) NULL DEFAULT ('NEW'),
              [AssignedStaffId] [UNIQUEIDENTIFIER] NULL,
              [AssignedStaffName] [VARCHAR](100) NULL,
              [AcceptedAt] [DATETIME] NULL,
              [ReadyAt] [DATETIME] NULL,
              [DeliveredAt] [DATETIME] NULL,
              [CompletedAt] [DATETIME] NULL,
              [Remarks] [VARCHAR](255) NULL
          )
      END
    `);

    await runQuery("Create Sessions table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Sessions]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Sessions](
              [SessionId] [NVARCHAR](88) NOT NULL,
              [Created] [DATETIME] NOT NULL,
              [Expires] [DATETIME] NOT NULL,
              [LockDate] [DATETIME] NOT NULL,
              [LockCookie] [INT] NOT NULL,
              [Locked] [BIT] NOT NULL,
              [SessionItem] [VARBINARY] NULL,
              [Flags] [INT] NOT NULL,
              [Timeout] [INT] NOT NULL
          )
      END
    `);

    await runQuery("Create settlement table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[settlement]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[settlement](
              [Id] [INT] NOT NULL,
              [OutletId] [INT] NULL,
              [SettlementDate] [DATE] NULL,
              [CashierName] [NVARCHAR](100) NULL,
              [OpeningCashJSON] [NVARCHAR](MAX) NULL,
              [OpeningCashTotal] [DECIMAL](10, 2) NULL,
              [PhysicalCashJSON] [NVARCHAR](MAX) NULL,
              [PhysicalCashTotal] [DECIMAL](10, 2) NULL,
              [TotalSales] [DECIMAL](10, 2) NULL,
              [TotalDiscount] [DECIMAL](10, 2) NULL,
              [VoidAmount] [DECIMAL](10, 2) NULL,
              [NetSales] [DECIMAL](10, 2) NULL,
              [CashReceived] [DECIMAL](10, 2) NULL,
              [ExpectedClosingCash] [DECIMAL](10, 2) NULL,
              [CashVariance] [DECIMAL](10, 2) NULL,
              [VarianceStatus] [NVARCHAR](50) NULL,
              [PaymentBreakdownJSON] [NVARCHAR](MAX) NULL,
              [Status] [NVARCHAR](50) NULL,
              [SettledBy] [NVARCHAR](100) NULL,
              [SettledAt] [DATETIME] NULL,
              [CreatedAt] [DATETIME] NULL,
              [UpdatedAt] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create SettlementCreditSales table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SettlementCreditSales]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[SettlementCreditSales](
              [SettlementID] [UNIQUEIDENTIFIER] NOT NULL,
              [PayMode] [VARCHAR](20) NOT NULL,
              [SysAmount] [MONEY] NOT NULL,
              [ManualAmount] [MONEY] NOT NULL,
              [AmountDiff] [MONEY] NOT NULL
          )
      END
    `);

    await runQuery("Create SettlementDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SettlementDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[SettlementDetail](
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [Paymode] [VARCHAR](50) NULL,
              [SysAmount] [MONEY] NULL,
              [ManualAmount] [MONEY] NULL,
              [SortageOrExces] [MONEY] NULL,
              [ReceiptCount] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [IsCollected] [BIT] NULL
          )
      END
    `);

    await runQuery("Create SettlementDiscountDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SettlementDiscountDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[SettlementDiscountDetail](
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [DiscountId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](50) NULL,
              [SysAmount] [MONEY] NULL,
              [ManualAmount] [MONEY] NULL,
              [SortageOrExces] [MONEY] NULL
          )
      END
    `);

    await runQuery("Create SettlementDoorDeliveryDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SettlementDoorDeliveryDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[SettlementDoorDeliveryDetail](
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [Paymode] [VARCHAR](50) NULL,
              [SysAmount] [MONEY] NULL,
              [ManualAmount] [MONEY] NULL,
              [SortageOrExces] [MONEY] NULL
          )
      END
    `);

    await runQuery("Create SettlementHeader table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SettlementHeader]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[SettlementHeader](
              [SettlementID] [UNIQUEIDENTIFIER] NULL,
              [CashierID] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [Shift] [NUMERIC](18, 2) NULL,
              [TerminalCode] [VARCHAR](50) NULL,
              [LastSettlementDate] [DATETIME] NULL,
              [SysAmount] [MONEY] NULL,
              [ManualAmount] [MONEY] NULL,
              [SortageOrExces] [MONEY] NULL,
              [isDayEnd] [BIT] NULL,
              [LastDayEndDate] [DATETIME] NULL,
              [CashIn] [MONEY] NULL,
              [CashOut] [MONEY] NULL,
              [TotalTax] [MONEY] NULL,
              [ServiceCharge] [MONEY] NULL,
              [DiscountAmount] [MONEY] NULL,
              [SubTotal] [MONEY] NULL,
              [RoundedBy] [MONEY] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [TotalPax] [NUMERIC](18, 2) NULL,
              [Tips] [MONEY] NULL,
              [VoidAmount] [MONEY] NULL,
              [InvoiceCount] [NUMERIC](8, 2) NULL,
              [CrAmount] [MONEY] NULL DEFAULT ((0)),
              [VoidItemQty] [NUMERIC](8, 2) NULL,
              [VoidItemAmount] [MONEY] NULL,
              [ExItemQty] [NUMERIC](18, 2) NULL,
              [ExItemAmount] [MONEY] NULL,
              [DisItemAmount] [MONEY] NULL,
              [PaymodeServiceCharge] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL DEFAULT ((0)),
              [RefundQty] [NUMERIC](18, 2) NULL,
              [RefundAmount] [NUMERIC](18, 4) NULL,
              [AdditionalServiceCharge] [MONEY] NULL DEFAULT ((0)),
              [DoorDeliveryAmount] [NUMERIC](10, 2) NULL DEFAULT ((0)),
              [RefNo] [VARCHAR](10) NULL,
              [DayendRefNo] [VARCHAR](10) NULL,
              [TACount] [NUMERIC](18, 4) NULL,
              [TAAmount] [MONEY] NULL,
              [DELCount] [NUMERIC](18, 4) NULL,
              [DELAmount] [MONEY] NULL,
              [BillNo] [NVARCHAR](50) NULL,
              [MemberId] [UNIQUEIDENTIFIER] NULL,
              [BillID] [INT] NULL,
              [OrderType] [NVARCHAR](50) NULL,
              [TableNo] [NVARCHAR](50) NULL,
              [Section] [NVARCHAR](100) NULL,
              [IsCancelled] [BIT] NULL DEFAULT ((0)),
              [CancellationReason] [NVARCHAR](500) NULL,
              [CancelledBy] [NVARCHAR](100) NULL,
              [CancelledDate] [DATETIME] NULL,
              [DiscountType] [NVARCHAR](50) NULL,
              [LegacyOrderId] [NVARCHAR](255) NULL,
              [OrderId] [INT] NOT NULL,
              [SER_NAME] [NVARCHAR](255) NULL,
              [MobileNo] [NVARCHAR](50) NULL,
              [CancelledByUserName] [NVARCHAR](100) NULL,
              [GuestName] [NVARCHAR](9) NULL,
              [Pax] [INT] NULL,
              [start_date] [DATE] NULL,
              [TakeawayCharge] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [IsVIP] [BIT] NULL DEFAULT ((0)),
              [VIPDiscountAmount] [DECIMAL](18, 2) NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create SettlementItemDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SettlementItemDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[SettlementItemDetail](
              [SettlementID] [UNIQUEIDENTIFIER] NULL,
              [DishName] [NVARCHAR](255) NULL,
              [Qty] [DECIMAL](18, 3) NULL,
              [Price] [DECIMAL](18, 2) NULL,
              [OrderDateTime] [DATETIME] NULL DEFAULT (getdate()),
              [DishId] [UNIQUEIDENTIFIER] NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NULL,
              [CategoryId] [UNIQUEIDENTIFIER] NULL,
              [SubCategoryId] [UNIQUEIDENTIFIER] NULL,
              [CategoryName] [NVARCHAR](255) NULL,
              [SubCategoryName] [NVARCHAR](255) NULL,
              [ID] [INT] NOT NULL,
              [Status] [NVARCHAR](50) NULL DEFAULT ('NORMAL'),
              [Spicy] [NVARCHAR](50) NULL,
              [Salt] [NVARCHAR](50) NULL,
              [Oil] [NVARCHAR](50) NULL,
              [Sugar] [NVARCHAR](50) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountType] [NVARCHAR](50) NULL,
              [OrderDetailId] [UNIQUEIDENTIFIER] NULL,
              [SongName] [NVARCHAR](200) NULL,
              [start_date] [DATE] NULL,
              [ComboDetailsJSON] [NVARCHAR](MAX) NULL,
              [VIPDiscountAmount] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [VIPRuleID] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create SettlementTotalSales table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SettlementTotalSales]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[SettlementTotalSales](
              [SettlementID] [UNIQUEIDENTIFIER] NOT NULL,
              [PayMode] [VARCHAR](20) NOT NULL,
              [SysAmount] [MONEY] NOT NULL,
              [ManualAmount] [MONEY] NOT NULL,
              [AmountDiff] [MONEY] NOT NULL,
              [ReceiptCount] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [GatewayReference] [NVARCHAR](100) NULL
          )
      END
    `);

    await runQuery("Create SettlementTranDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SettlementTranDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[SettlementTranDetail](
              [SettlementID] [UNIQUEIDENTIFIER] NOT NULL,
              [PayMode] [VARCHAR](20) NOT NULL,
              [CashIn] [NUMERIC](18, 2) NOT NULL,
              [CashOut] [NUMERIC](18, 2) NOT NULL
          )
      END
    `);

    await runQuery("Create Sheet1 table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Sheet1]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Sheet1](
              [Category] [NVARCHAR](255) NULL,
              [GroupName] [NVARCHAR](255) NULL,
              [DishName] [NVARCHAR](255) NULL,
              [Price] [FLOAT] NULL
          )
      END
    `);

    await runQuery("Create Sheet2 table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Sheet2]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Sheet2](
              [Category] [NVARCHAR](255) NULL
          )
      END
    `);

    await runQuery("Create Sheet3 table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Sheet3]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[Sheet3](
              [Category] [NVARCHAR](255) NULL,
              [GroupName] [NVARCHAR](255) NULL
          )
      END
    `);

    await runQuery("Create SiteMapMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SiteMapMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[SiteMapMaster](
              [SiteMapId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModuleName] [VARCHAR](50) NOT NULL,
              [Entity] [VARCHAR](50) NOT NULL,
              [DisplayName] [VARCHAR](100) NOT NULL,
              [URL] [VARCHAR](100) NOT NULL,
              [QueryString] [VARCHAR](100) NULL,
              [IsModule] [BIT] NOT NULL,
              [SortCode] [INT] NOT NULL
          )
      END
    `);

    await runQuery("Create StatusMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[StatusMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[StatusMaster](
              [TableName] [VARCHAR](50) NOT NULL,
              [FieldName] [VARCHAR](100) NOT NULL,
              [StatusNumber] [INT] NOT NULL,
              [StatusValue] [VARCHAR](100) NOT NULL,
              [DisplayOrder] [INT] NOT NULL,
              [IsDefault] [BIT] NOT NULL
          )
      END
    `);

    await runQuery("Create StockLock table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[StockLock]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[StockLock](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [QuantityOnHand] [INT] NULL,
              [StockDate] [DATETIME] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifiedOn] [DATETIME] NOT NULL
          )
      END
    `);

    await runQuery("Create TableDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TableDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TableDetail](
              [TableName] [VARCHAR](100) NOT NULL,
              [FieldName] [VARCHAR](100) NOT NULL,
              [DisplayName] [VARCHAR](100) NULL,
              [SortCode] [INT] NULL
          )
      END
    `);

    await runQuery("Create TableHeader table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TableHeader]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TableHeader](
              [TableName] [VARCHAR](100) NOT NULL,
              [DisplayName] [VARCHAR](100) NOT NULL,
              [ReportName] [VARCHAR](100) NULL,
              [SortCode] [INT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create TableMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TableMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TableMaster](
              [TableId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [TableNumber] [VARCHAR](20) NULL,
              [Seats] [NUMERIC](18, 2) NOT NULL,
              [ReservationAllowed] [BIT] NOT NULL,
              [DiningSection] [VARCHAR](10) NULL,
              [StartTime] [VARCHAR](50) NULL,
              [EndTime] [VARCHAR](50) NULL,
              [SortCode] [NUMERIC](5, 2) NULL,
              [Row] [INT] NULL,
              [Col] [INT] NULL,
              [PrintSection] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [Status] [INT] NULL,
              [Terminal] [VARCHAR](10) NULL,
              [LoginUser] [VARCHAR](10) NULL,
              [IstakeAway] [BIT] NULL DEFAULT ((0)),
              [TableType] [VARCHAR](20) NULL,
              [XSize] [INT] NULL,
              [YSize] [INT] NULL,
              [XPos] [INT] NULL,
              [YPos] [INT] NULL,
              [Remarks] [VARCHAR](100) NULL,
              [TableLayoutBG] [VARCHAR](50) NULL,
              [LockedByName] [NVARCHAR](255) NULL,
              [IsLocked] [BIT] NULL DEFAULT ((0)),
              [TotalAmount] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [CurrentOrderId] [NVARCHAR](50) NULL,
              [entry_status] [NVARCHAR](50) NULL,
              [PAYMENT_STATUS] [INT] NULL,
              [CustomerName] [NVARCHAR](9) NULL,
              [Pax] [INT] NULL
          )
      END
    `);

    await runQuery("Create TBLERRDATELOG table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TBLERRDATELOG]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TBLERRDATELOG](
              [ID] [INT] NOT NULL,
              [RESULT] [VARCHAR](200) NULL,
              [DATE] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tblErrorHandler table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tblErrorHandler]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tblErrorHandler](
              [Query] [VARCHAR](8000) NULL,
              [Error] [VARCHAR](8000) NULL,
              [CreateDate] [SMALLDATETIME] NULL
          )
      END
    `);

    await runQuery("Create tblMaDashBoardLocation table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tblMaDashBoardLocation]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tblMaDashBoardLocation](
              [unid] [UNIQUEIDENTIFIER] NULL,
              [LocationCode] [VARCHAR](10) NOT NULL,
              [LocationName] [VARCHAR](50) NULL,
              [RegionCode] [VARCHAR](10) NULL,
              [CompanyCode] [VARCHAR](10) NULL,
              [Address1] [VARCHAR](50) NULL,
              [Address2] [VARCHAR](50) NULL,
              [Address3] [VARCHAR](50) NULL,
              [TelePhone] [VARCHAR](50) NULL,
              [Fax] [VARCHAR](50) NULL,
              [ShortCode] [INT] NULL,
              [EODDate] [SMALLDATETIME] NULL,
              [CreateUser] [VARCHAR](10) NULL,
              [CreateDate] [SMALLDATETIME] NULL,
              [ModifyUser] [VARCHAR](10) NULL,
              [ModifyDate] [SMALLDATETIME] NULL,
              [Warehouse] [BIT] NULL,
              [PriceControl] [VARCHAR](100) NULL,
              [SynchDate] [DATETIME] NULL,
              [SalesUploadDate] [DATETIME] NULL,
              [CostControl] [CHAR](100) NULL,
              [IsActive] [VARCHAR](1) NULL
          )
      END
    `);

    await runQuery("Create tblModifierOrderCart table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tblModifierOrderCart]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tblModifierOrderCart](
              [CartId] [VARCHAR](20) NOT NULL,
              [OrderDetailId] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [Quantity] [INT] NOT NULL,
              [Cost] [DECIMAL](18, 2) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [Modifiername] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create tblOrderCart table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tblOrderCart]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tblOrderCart](
              [CartID] [INT] NOT NULL,
              [TableNo] [VARCHAR](50) NULL,
              [CategoryCode] [VARCHAR](50) NULL,
              [DishId] [UNIQUEIDENTIFIER] NULL,
              [DishItemCode] [VARCHAR](50) NULL,
              [Qty] [DECIMAL](18, 2) NULL,
              [Persons] [DECIMAL](18, 2) NULL,
              [OrderID] [VARCHAR](200) NULL,
              [IsCustomerConfirmed] [BIT] NULL,
              [IsConfirmed] [BIT] NULL,
              [IsComplete] [BIT] NULL,
              [ModifierName] [VARCHAR](200) NULL,
              [ModifierCost] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create tblOrderCartModifierDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tblOrderCartModifierDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tblOrderCartModifierDetail](
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [Quantity] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [Modifiername] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create TblPaymentStatus table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TblPaymentStatus]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TblPaymentStatus](
              [JsonMsg] [NVARCHAR](MAX) NULL,
              [Status] [NVARCHAR](MAX) NULL,
              [CreateDate] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tblPOSPayModeDetailCurSalesDashboard table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tblPOSPayModeDetailCurSalesDashboard]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tblPOSPayModeDetailCurSalesDashboard](
              [InvoiceNo] [VARCHAR](20) NOT NULL,
              [InvoiceDate] [DATETIME] NOT NULL,
              [PayMode] [CHAR](10) NOT NULL,
              [Amount] [NUMERIC](18, 2) NULL,
              [Commision] [NUMERIC](18, 2) NULL,
              [SlipNo] [VARCHAR](50) NULL,
              [unid] [UNIQUEIDENTIFIER] NULL,
              [CreateUser] [VARCHAR](10) NOT NULL,
              [CreateDate] [DATETIME] NOT NULL,
              [ModifyUser] [VARCHAR](10) NULL,
              [ModifyDate] [DATETIME] NOT NULL
          )
      END
    `);

    await runQuery("Create tblPOSSalesDetailCurSalesDashboard table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tblPOSSalesDetailCurSalesDashboard]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tblPOSSalesDetailCurSalesDashboard](
              [InvoiceNo] [VARCHAR](20) NOT NULL,
              [InventoryCode] [VARCHAR](20) NOT NULL,
              [Description] [NVARCHAR](400) NULL,
              [Qty] [NUMERIC](18, 3) NULL,
              [Price] [NUMERIC](18, 2) NOT NULL,
              [TotalValue] [NUMERIC](18, 2) NULL,
              [Discount] [NUMERIC](18, 2) NULL,
              [NetDiscount] [NUMERIC](18, 2) NULL,
              [NetAmount] [NUMERIC](18, 2) NULL,
              [ActualSales] [NUMERIC](18, 2) NULL,
              [Gst] [NUMERIC](18, 4) NULL,
              [SalesManId] [VARCHAR](10) NULL,
              [DeptCode] [VARCHAR](10) NULL,
              [CategoryCode] [VARCHAR](10) NULL,
              [BrandCode] [VARCHAR](MAX) NULL,
              [AverageCost] [NUMERIC](18, 4) NULL,
              [MemberDiscount] [NUMERIC](18, 2) NULL,
              [LocationCode] [VARCHAR](20) NULL,
              [UnitCost] [NUMERIC](18, 2) NULL,
              [PRMFlag] [CHAR](1) NULL,
              [EventDesc] [VARCHAR](100) NULL,
              [FreeItem] [CHAR](10) NULL,
              [SComPercent] [NUMERIC](18, 2) NULL,
              [MerchandiseCode] [VARCHAR](50) NULL,
              [SellingPrice] [NUMERIC](18, 2) NULL,
              [CreateUser] [VARCHAR](10) NOT NULL,
              [CreateDate] [DATETIME] NOT NULL,
              [ModifyUser] [VARCHAR](10) NULL,
              [ModifyDate] [DATETIME] NULL,
              [PackageItem] [BIT] NULL,
              [SubTotal] [NUMERIC](18, 2) NULL,
              [RetailPrice] [NUMERIC](18, 2) NULL,
              [TaxPerc] [NUMERIC](18, 2) NULL,
              [ExpiryDate] [CHAR](8) NULL,
              [BatchNo] [NVARCHAR](100) NULL,
              [MRP] [MONEY] NULL,
              [BinNo] [CHAR](10) NULL,
              [CardType] [CHAR](10) NULL,
              [CardCommPerc] [NUMERIC](18, 2) NULL,
              [UserDefined1] [NUMERIC](4, 2) NULL,
              [UserDefined2] [NUMERIC](4, 2) NULL,
              [UserDefined3] [NUMERIC](4, 2) NULL,
              [SerialNo] [VARCHAR](50) NULL,
              [MXRemarks] [VARCHAR](120) NULL,
              [Remarks] [VARCHAR](100) NULL,
              [PromotionCode] [VARCHAR](10) NULL,
              [PromotionName] [VARCHAR](50) NULL,
              [unid] [UNIQUEIDENTIFIER] NULL,
              [SalesManCode] [VARCHAR](10) NULL
          )
      END
    `);

    await runQuery("Create tblPOSSalesHeaderCurSalesDashboard table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tblPOSSalesHeaderCurSalesDashboard]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tblPOSSalesHeaderCurSalesDashboard](
              [InvoiceNo] [VARCHAR](20) NOT NULL,
              [InvoiceDate] [DATETIME] NULL,
              [TotalValue] [NUMERIC](18, 2) NULL,
              [Gst] [NUMERIC](18, 4) NULL,
              [DetailDiscount] [NUMERIC](18, 2) NULL,
              [NetDiscountAmount] [NUMERIC](18, 2) NULL,
              [NetDiscountPerc] [NUMERIC](18, 2) NULL,
              [DiscountType] [CHAR](15) NULL,
              [NetTotal] [NUMERIC](18, 2) NULL,
              [CashierID] [VARCHAR](10) NULL,
              [LocationCode] [VARCHAR](10) NULL,
              [TerminalCode] [CHAR](10) NOT NULL,
              [TotalLines] [INT] NULL,
              [TenderAmount] [NUMERIC](18, 2) NULL,
              [Balance] [NUMERIC](18, 2) NULL,
              [SalesType] [CHAR](10) NULL,
              [CustomerCode] [CHAR](10) NULL,
              [CustomerName] [CHAR](50) NULL,
              [TotalDiscount] [NUMERIC](18, 2) NULL,
              [Address1] [CHAR](50) NULL,
              [Address2] [CHAR](50) NULL,
              [Address3] [CHAR](50) NULL,
              [Phone] [CHAR](15) NULL,
              [Fax] [CHAR](15) NULL,
              [MemberDiscount] [NUMERIC](18, 2) NULL,
              [GstType] [CHAR](1) NULL,
              [PaidStatus] [NCHAR](10) NULL,
              [ChequeNo] [NCHAR](10) NULL,
              [ChequeDate] [DATETIME] NULL,
              [CreateUser] [CHAR](10) NOT NULL,
              [CreateDate] [DATETIME] NOT NULL,
              [ModifyDate] [DATETIME] NULL,
              [ModifyUser] [CHAR](10) NULL,
              [PackageType] [NCHAR](3) NULL,
              [RoundOff] [NUMERIC](18, 2) NULL,
              [ShippingSlNo] [SMALLINT] NULL,
              [ShippingTo] [VARCHAR](50) NULL,
              [ShippingAddr1] [VARCHAR](50) NULL,
              [ShippingAddr2] [VARCHAR](50) NULL,
              [ShippingPhone] [VARCHAR](12) NULL,
              [ShippingFax] [VARCHAR](12) NULL,
              [Remarks] [NVARCHAR](200) NOT NULL,
              [Officialremarks] [NVARCHAR](200) NULL,
              [DiscountRemarks] [VARCHAR](200) NULL,
              [Delivered] [BIT] NULL,
              [DeliverymanId] [CHAR](10) NULL,
              [DeliverDate] [DATETIME] NULL,
              [AccFlag] [CHAR](1) NULL,
              [unid] [UNIQUEIDENTIFIER] NULL,
              [ShiftNo] [INT] NULL
          )
      END
    `);

    await runQuery("Create TblSelfOrderDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TblSelfOrderDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TblSelfOrderDetail](
              [MobileNo] [VARCHAR](20) NULL,
              [PaymentID] [UNIQUEIDENTIFIER] NULL,
              [SelfOrderNo] [VARCHAR](20) NULL,
              [OrderNo] [VARCHAR](20) NULL,
              [TableNo] [CHAR](10) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [SubTotal] [DECIMAL](18, 2) NULL,
              [Tax] [DECIMAL](18, 2) NULL,
              [PI_Datetime] [DATETIME] NULL,
              [Current_Status] [VARCHAR](20) NULL,
              [PLUS_Datetime] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create TblSelfOrderDetailHistory table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TblSelfOrderDetailHistory]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TblSelfOrderDetailHistory](
              [MobileNo] [VARCHAR](20) NULL,
              [PaymentID] [UNIQUEIDENTIFIER] NULL,
              [SelfOrderNo] [VARCHAR](20) NULL,
              [OrderNo] [VARCHAR](20) NULL,
              [TableNo] [CHAR](10) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [SubTotal] [DECIMAL](18, 2) NULL,
              [Tax] [DECIMAL](18, 2) NULL,
              [PI_Datetime] [DATETIME] NULL,
              [Current_Status] [VARCHAR](20) NULL,
              [PLUS_Datetime] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tblTempDeleteStock table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tblTempDeleteStock]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tblTempDeleteStock](
              [TranId] [UNIQUEIDENTIFIER] NOT NULL,
              [TranNo] [VARCHAR](20) NOT NULL,
              [TranType] [CHAR](6) NOT NULL,
              [ItemCode] [VARCHAR](20) NOT NULL,
              [ItemDesc] [NVARCHAR](200) NULL,
              [BusinessUnitCode] [VARCHAR](15) NULL,
              [PrcCode] [VARCHAR](15) NOT NULL,
              [Uom] [VARCHAR](15) NOT NULL,
              [DeptCode] [VARCHAR](20) NULL,
              [Categorycode] [VARCHAR](15) NULL,
              [Qty] [DECIMAL](18, 3) NOT NULL,
              [UnitPrice] [DECIMAL](18, 4) NOT NULL,
              [Totalamount] [DECIMAL](18, 4) NOT NULL,
              [DetailDiscPerc] [DECIMAL](18, 4) NOT NULL,
              [DetailDiscAmount] [DECIMAL](19, 4) NOT NULL,
              [TotalValue] [DECIMAL](18, 4) NOT NULL,
              [NetDiscAmount] [DECIMAL](19, 4) NOT NULL,
              [TotalDiscAmount] [DECIMAL](19, 4) NULL,
              [NetValue] [DECIMAL](18, 4) NULL,
              [FocQty] [DECIMAL](18, 3) NOT NULL,
              [NetPrice] [DECIMAL](18, 4) NOT NULL,
              [GstPerc] [DECIMAL](18, 2) NOT NULL,
              [GstAmt] [DECIMAL](19, 4) NOT NULL,
              [NetAmount] [DECIMAL](18, 4) NOT NULL,
              [LocationCode] [VARCHAR](50) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifiedOn] [DATETIME] NOT NULL
          )
      END
    `);

    await runQuery("Create temp table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[temp]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[temp](
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [Ordernumber] [VARCHAR](20) NOT NULL,
              [PrintType] [INT] NOT NULL,
              [orderDate] [DATETIME] NOT NULL,
              [isEditOrder] [BIT] NULL
          )
      END
    `);

    await runQuery("Create tempCancelRemarksMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempCancelRemarksMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempCancelRemarksMaster](
              [CRCode] [VARCHAR](50) NULL,
              [CRName] [VARCHAR](100) NULL,
              [SortCode] [INT] NULL
          )
      END
    `);

    await runQuery("Create TempCartitemsModifier table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TempCartitemsModifier]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TempCartitemsModifier](
              [CartId] [NVARCHAR](MAX) NULL,
              [ProductId] [NVARCHAR](MAX) NULL,
              [MobileNo] [NVARCHAR](100) NULL,
              [ModifierName] [NVARCHAR](MAX) NULL,
              [ModifierCode] [VARCHAR](20) NULL,
              [DetailID] [UNIQUEIDENTIFIER] NULL,
              [ModfierCost] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create TempCartitemsModifierDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TempCartitemsModifierDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TempCartitemsModifierDetail](
              [CartId] [NVARCHAR](MAX) NULL,
              [ProductId] [NVARCHAR](MAX) NULL,
              [MobileNo] [NVARCHAR](100) NULL,
              [Dishid] [UNIQUEIDENTIFIER] NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NULL,
              [DetailID] [UNIQUEIDENTIFIER] NULL,
              [ModfierCost] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create TempCategoryMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TempCategoryMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TempCategoryMaster](
              [CategoryId] [UNIQUEIDENTIFIER] NOT NULL,
              [CategoryCode] [VARCHAR](10) NOT NULL,
              [CategoryName] [VARCHAR](100) NOT NULL,
              [ShortName] [VARCHAR](10) NULL,
              [NameInOtherLanguage] [NCHAR](100) NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [BackColor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [isKitchenPrint] [BIT] NOT NULL,
              [isDiscountAllowed] [BIT] NOT NULL,
              [isServiceCharge] [BIT] NOT NULL,
              [IsDispName] [BIT] NOT NULL,
              [isMemberSalesAllowed] [BIT] NOT NULL,
              [IsTaxAllowed] [BIT] NOT NULL,
              [SortCode] [INT] NOT NULL,
              [isActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tempCreditPayment table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempCreditPayment]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempCreditPayment](
              [CreditPaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreditNumber] [VARCHAR](20) NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NULL,
              [Paymode] [CHAR](10) NULL,
              [Amount] [DECIMAL](18, 2) NULL,
              [ReferenceNumber] [VARCHAR](20) NULL,
              [Remarks] [VARCHAR](150) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL,
              [ReturnAmt] [NUMERIC](10, 2) NULL,
              [PayAmount] [NUMERIC](10, 2) NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL,
              [isUploadHQ] [BIT] NULL
          )
      END
    `);

    await runQuery("Create tempCreditPaymentDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempCreditPaymentDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempCreditPaymentDetail](
              [CreditPaymentDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreditPaymentId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [BalanceAmount] [DECIMAL](18, 2) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tempCustomerMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempCustomerMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempCustomerMaster](
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL,
              [CustomerCode] [VARCHAR](20) NOT NULL,
              [Name] [VARCHAR](160) NOT NULL,
              [ContactPerson] [VARCHAR](100) NOT NULL,
              [GovermentId] [VARCHAR](50) NOT NULL,
              [CategoryCode] [INT] NOT NULL,
              [ClassificationCode] [INT] NOT NULL,
              [EmailId1] [VARCHAR](100) NULL,
              [EmailId2] [VARCHAR](100) NULL,
              [WebSite] [VARCHAR](200) NULL,
              [Address1_Name] [VARCHAR](200) NULL,
              [Address1_Id] [UNIQUEIDENTIFIER] NULL,
              [Address1_TypeCode] [INT] NOT NULL,
              [Address1_PrimaryContactName] [VARCHAR](150) NULL,
              [Address1_Line1] [VARCHAR](50) NOT NULL,
              [Address1_Line2] [VARCHAR](50) NULL,
              [Address1_Line3] [VARCHAR](50) NULL,
              [Address1_City] [VARCHAR](50) NULL,
              [Address1_State] [VARCHAR](50) NULL,
              [Address1_Country] [VARCHAR](50) NULL,
              [Address1_PostalCode] [VARCHAR](20) NULL,
              [Address1_Telephone1] [VARCHAR](20) NOT NULL,
              [Address1_Telephone2] [VARCHAR](20) NULL,
              [Address1_Fax] [VARCHAR](20) NULL,
              [Address1_FreightTermCode] [INT] NULL,
              [Address1_ShippingMethodCode] [INT] NULL,
              [Address2_Name] [VARCHAR](200) NULL,
              [Address2_Id] [UNIQUEIDENTIFIER] NULL,
              [Address2_TypeCode] [INT] NULL,
              [Address2_PrimaryContactName] [VARCHAR](150) NULL,
              [Address2_Line1] [VARCHAR](50) NULL,
              [Address2_Line2] [VARCHAR](50) NULL,
              [Address2_Line3] [VARCHAR](50) NULL,
              [Address2_City] [VARCHAR](50) NULL,
              [Address2_State] [VARCHAR](50) NULL,
              [Address2_Country] [VARCHAR](50) NULL,
              [Address2_PostalCode] [VARCHAR](20) NULL,
              [Address2_Telephone1] [VARCHAR](20) NULL,
              [Address2_Telephone2] [VARCHAR](20) NULL,
              [Address2_Fax] [VARCHAR](20) NULL,
              [Address2_FreightTermCode] [INT] NULL,
              [Address2_ShippingMethodCode] [INT] NULL,
              [PaymentTermsCode] [INT] NULL,
              [CreditLimit] [DECIMAL](18, 2) NULL,
              [CreditOnHold] [BIT] NULL,
              [RevenueThisYear] [DECIMAL](18, 2) NULL,
              [Aging30] [DECIMAL](18, 2) NULL,
              [Aging60] [DECIMAL](18, 2) NULL,
              [Aging90] [DECIMAL](18, 2) NULL,
              [StatusCode] [INT] NOT NULL,
              [OwnerBusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [GstType] [CHAR](1) NULL,
              [isServiceChargeAllowed] [BIT] NULL,
              [DOB] [SMALLDATETIME] NULL,
              [Anniversary] [SMALLDATETIME] NULL,
              [CardNo] [VARCHAR](20) NULL,
              [FromDate] [DATETIME] NULL,
              [ToDate] [DATETIME] NULL,
              [Remarks] [VARCHAR](100) NULL,
              [Clssificationcodename] [VARCHAR](100) NULL,
              [TotalPoints] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [RedeemPoints] [NUMERIC](18, 2) NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create tempDeliveryPerson table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDeliveryPerson]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDeliveryPerson](
              [DeliveryPersonId] [UNIQUEIDENTIFIER] NULL,
              [DeliveryPersonCode] [VARCHAR](50) NULL,
              [DeliveryPersonName] [VARCHAR](50) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [VARCHAR](50) NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create TEMPDISH table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TEMPDISH]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TEMPDISH](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishCode] [VARCHAR](20) NOT NULL,
              [Name] [NVARCHAR](300) NULL,
              [NameInOtherLanguage] [NVARCHAR](150) NULL,
              [Description] [NVARCHAR](4000) NULL,
              [KitchenType] [INT] NOT NULL,
              [SubkitchenType] [INT] NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [DefaultPriceListId] [UNIQUEIDENTIFIER] NULL,
              [CurrentCost] [DECIMAL](18, 2) NULL,
              [CookingBusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [QuantityOnHand] [DECIMAL](18, 2) NULL,
              [SupplierId] [UNIQUEIDENTIFIER] NULL,
              [IsActive] [BIT] NOT NULL,
              [IsStandardMenu] [BIT] NULL,
              [IsStockDish] [BIT] NULL,
              [IsDoorDeliveryDish] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [iskitchenPrint] [BIT] NULL,
              [isServiceCharge] [BIT] NULL,
              [SordCode] [NUMERIC](10, 2) NULL,
              [ShortName] [VARCHAR](15) NULL,
              [MobileTab] [INT] NULL,
              [isDiscountAllowed] [BIT] NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [BrandId] [UNIQUEIDENTIFIER] NULL,
              [backColor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [isFOC] [BIT] NULL,
              [isOpenitem] [BIT] NULL,
              [UnitCost] [NUMERIC](18, 2) NULL,
              [Discountid] [UNIQUEIDENTIFIER] NULL,
              [IsDispName] [BIT] NULL,
              [isIngredient] [BIT] NULL,
              [IsTaxAllowed] [BIT] NULL,
              [isMultiPrice] [BIT] NULL,
              [IsShowinKiosk] [BIT] NULL,
              [AvailableTimeFrom] [VARCHAR](100) NULL,
              [AvailableTimeTo] [VARCHAR](100) NULL
          )
      END
    `);

    await runQuery("Create TEMPDISHGROUP table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TEMPDISHGROUP]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TEMPDISHGROUP](
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishGroupCode] [VARCHAR](20) NOT NULL,
              [DishGroupName] [NVARCHAR](150) NULL,
              [SortCode] [INT] NOT NULL,
              [IsActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [ShortName] [VARCHAR](10) NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [BackColor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [isKitchenprint] [BIT] NULL,
              [isDiscountAllowed] [BIT] NULL,
              [isServiceCharge] [BIT] NULL,
              [IsDispName] [BIT] NULL,
              [isMemberSalesAllowed] [BIT] NULL,
              [IsTaxAllowed] [BIT] NULL,
              [NameInOtherLanguage] [NVARCHAR](150) NULL,
              [CategoryId] [UNIQUEIDENTIFIER] NULL,
              [KitchenSortCode] [INT] NULL,
              [IsShowinKiosk] [BIT] NULL,
              [NEWGROUPID] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create tempDishGroupKitchenType table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDishGroupKitchenType]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDishGroupKitchenType](
              [DishGroupid] [UNIQUEIDENTIFIER] NULL,
              [KitchenTypeCode] [VARCHAR](5) NULL,
              [KitchenTypeName] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create tempDishGroupmaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDishGroupmaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDishGroupmaster](
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishGroupCode] [VARCHAR](20) NOT NULL,
              [DishGroupName] [NVARCHAR](150) NULL,
              [SortCode] [INT] NOT NULL,
              [IsActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [ShortName] [VARCHAR](10) NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [BackColor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [isKitchenprint] [BIT] NULL,
              [isDiscountAllowed] [BIT] NULL,
              [isServiceCharge] [BIT] NULL,
              [IsDispName] [BIT] NULL,
              [isMemberSalesAllowed] [BIT] NULL,
              [IsTaxAllowed] [BIT] NULL,
              [NameInOtherLanguage] [NVARCHAR](150) NULL,
              [CategoryId] [UNIQUEIDENTIFIER] NULL,
              [KitchenSortCode] [INT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create tempdishgroupmodifier table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempdishgroupmodifier]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempdishgroupmodifier](
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create TempDishInventoryMovement table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TempDishInventoryMovement]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TempDishInventoryMovement](
              [TranType] [VARCHAR](15) NULL,
              [TranDate] [DATETIME] NULL,
              [TranNo] [VARCHAR](100) NULL,
              [CategoryId] [UNIQUEIDENTIFIER] NULL,
              [CategoryName] [NVARCHAR](600) NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NULL,
              [DishGroupName] [NVARCHAR](300) NULL,
              [Code] [VARCHAR](20) NULL,
              [Name] [VARCHAR](100) NULL,
              [PQty] [DECIMAL](18, 2) NULL,
              [PRQty] [DECIMAL](18, 2) NULL,
              [SQty] [DECIMAL](18, 2) NULL,
              [SRQty] [DECIMAL](18, 2) NULL,
              [OpeningStock] [DECIMAL](18, 2) NULL,
              [ClosingStock] [DECIMAL](18, 2) NULL,
              [UnitPrice] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create tempDishKitchenType table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDishKitchenType]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDishKitchenType](
              [Dishid] [UNIQUEIDENTIFIER] NULL,
              [KitchenTypeCode] [VARCHAR](5) NULL,
              [KitchenTypeName] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create tempDishMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDishMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDishMaster](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishCode] [VARCHAR](20) NOT NULL,
              [Name] [VARCHAR](150) NOT NULL,
              [NameInOtherLanguage] [NVARCHAR](150) NULL,
              [Description] [NVARCHAR](150) NULL,
              [KitchenType] [INT] NOT NULL,
              [SubkitchenType] [INT] NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [DefaultPriceListId] [UNIQUEIDENTIFIER] NULL,
              [CurrentCost] [DECIMAL](18, 2) NULL,
              [CookingBusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [QuantityOnHand] [DECIMAL](18, 2) NULL,
              [SupplierId] [UNIQUEIDENTIFIER] NULL,
              [IsActive] [BIT] NOT NULL,
              [IsStandardMenu] [BIT] NULL,
              [IsStockDish] [BIT] NULL,
              [IsDoorDeliveryDish] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [iskitchenPrint] [BIT] NULL,
              [isServiceCharge] [BIT] NULL,
              [SortCode] [NUMERIC](10, 2) NULL,
              [ShortName] [VARCHAR](15) NULL,
              [MobileTab] [INT] NULL,
              [isDiscountAllowed] [BIT] NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [BrandId] [UNIQUEIDENTIFIER] NULL,
              [backColor] [VARCHAR](50) NULL,
              [ForeColor] [VARCHAR](50) NULL,
              [isFOC] [BIT] NULL,
              [isOpenitem] [BIT] NULL,
              [UnitCost] [NUMERIC](18, 2) NULL,
              [Discountid] [UNIQUEIDENTIFIER] NULL,
              [IsDispName] [BIT] NULL,
              [isIngredient] [BIT] NULL,
              [IsTaxAllowed] [BIT] NULL,
              [isMultiPrice] [BIT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create tempDishModifier table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDishModifier]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDishModifier](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tempDishpriceList table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDishpriceList]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDishpriceList](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [PriceListId] [UNIQUEIDENTIFIER] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create tempDoorDeliveryMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDoorDeliveryMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDoorDeliveryMaster](
              [OrderTypeCode] [VARCHAR](20) NULL,
              [OrderTypeName] [VARCHAR](50) NULL,
              [IsActive] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [NCHAR](10) NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [NCHAR](10) NULL
          )
      END
    `);

    await runQuery("Create tempDoorDeliveryOrder table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDoorDeliveryOrder]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDoorDeliveryOrder](
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DoorDeliveryOrderNumber] [VARCHAR](20) NOT NULL,
              [Title] [VARCHAR](300) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NOT NULL,
              [ContactPerson] [VARCHAR](100) NOT NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [FunctionDateTime] [DATETIME] NULL,
              [DateFullfilled] [DATETIME] NULL,
              [PaymentTermCode] [INT] NULL,
              [PriceLevelId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [OperationDescription] [VARCHAR](100) NULL,
              [BillToName] [VARCHAR](200) NULL,
              [BillTo_Line1] [VARCHAR](50) NULL,
              [BillTo_Line2] [VARCHAR](50) NULL,
              [BillTo_Line3] [VARCHAR](50) NULL,
              [BillTo_City] [VARCHAR](50) NULL,
              [BillTo_State] [VARCHAR](50) NULL,
              [BillTo_Country] [VARCHAR](50) NULL,
              [BillTo_PostalCode] [VARCHAR](20) NULL,
              [BillTo_Telephone] [VARCHAR](20) NULL,
              [BillTo_Fax] [VARCHAR](20) NULL,
              [ShippingMethodCode] [INT] NULL,
              [ShipTo_Name] [VARCHAR](200) NULL,
              [ShipTo_Line1] [VARCHAR](50) NULL,
              [ShipTo_Line2] [VARCHAR](50) NULL,
              [ShipTo_Line3] [VARCHAR](50) NULL,
              [ShipTo_City] [VARCHAR](50) NULL,
              [ShipTo_State] [VARCHAR](50) NULL,
              [ShipTo_Country] [VARCHAR](50) NULL,
              [ShipTo_PostalCode] [VARCHAR](20) NULL,
              [ShipTo_Telephone] [VARCHAR](20) NULL,
              [ShipTo_Fax] [VARCHAR](20) NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [DailyOrderSequenceNumber] [INT] NULL,
              [InformKitchen] [BIT] NULL,
              [IsViewed] [BIT] NULL,
              [PriorityCode] [INT] NULL,
              [DeliveryPersonId] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tempDoorDeliveryOrderDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDoorDeliveryOrderDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDoorDeliveryOrderDetail](
              [DoorDeliveryOrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Discription] [VARCHAR](150) NOT NULL,
              [Quantity] [DECIMAL](18, 2) NOT NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [AssociatedDishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tempDoorDeliveryPaymentdetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempDoorDeliveryPaymentdetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempDoorDeliveryPaymentdetail](
              [PaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [BilledFor] [INT] NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryPersonId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NOT NULL,
              [PaymentType] [INT] NOT NULL,
              [Paymode] [INT] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [ReferenceNumber] [VARCHAR](20) NULL,
              [Remarks] [VARCHAR](150) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL,
              [ReturnAmt] [NUMERIC](10, 2) NULL,
              [PayAmount] [NUMERIC](10, 2) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL,
              [PaymodeServiceChargeAmount] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL
          )
      END
    `);

    await runQuery("Create tempHappyHours table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempHappyHours]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempHappyHours](
              [PromotionId] [UNIQUEIDENTIFIER] NOT NULL,
              [PromotionCode] [VARCHAR](20) NOT NULL,
              [Description] [VARCHAR](50) NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [FromDate] [SMALLDATETIME] NOT NULL,
              [ToDate] [SMALLDATETIME] NOT NULL,
              [FromTime] [CHAR](10) NULL,
              [ToTime] [CHAR](10) NULL,
              [PromotionDay] [VARCHAR](50) NOT NULL,
              [PromotionPerc] [NUMERIC](18, 2) NOT NULL,
              [PromotionPrice] [NUMERIC](18, 2) NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModyfiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModyfiedOn] [DATETIME] NULL,
              [DishGroupId] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create TempHQInventoryStock table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TempHQInventoryStock]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TempHQInventoryStock](
              [InventoryID] [UNIQUEIDENTIFIER] NOT NULL,
              [QuantityOnHand] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifiedOn] [DATETIME] NOT NULL
          )
      END
    `);

    await runQuery("Create tempImage table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempImage]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempImage](
              [Imageid] [UNIQUEIDENTIFIER] NOT NULL,
              [PaymodePosition] [INT] NOT NULL,
              [ImageName] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create tempImageList table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempImageList]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempImageList](
              [Imageid] [UNIQUEIDENTIFIER] NOT NULL,
              [ImageName] [VARCHAR](50) NULL,
              [ImageIcon] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create tempInventoryTSGroupUPS table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempInventoryTSGroupUPS]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempInventoryTSGroupUPS](
              [GroupCode] [CHAR](20) NULL,
              [Description] [CHAR](50) NOT NULL,
              [CreateUser] [CHAR](10) NULL,
              [CreateDate] [DATETIME] NOT NULL,
              [ModifyUser] [CHAR](10) NULL,
              [ModifyDate] [DATETIME] NOT NULL,
              [SortCode] [NUMERIC](18, 2) NULL,
              [TerminalGroup] [VARCHAR](20) NULL
          )
      END
    `);

    await runQuery("Create tempInventoryTSListUPS table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempInventoryTSListUPS]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempInventoryTSListUPS](
              [InventoryCode] [CHAR](20) NULL,
              [Description] [CHAR](50) NOT NULL,
              [GroupCode] [CHAR](20) NULL,
              [CreateUser] [CHAR](10) NULL,
              [CreateDate] [DATETIME] NOT NULL,
              [ModifyUser] [CHAR](10) NULL,
              [ModifyDate] [DATETIME] NOT NULL,
              [SortCode] [NUMERIC](18, 2) NULL,
              [TerminalGroup] [VARCHAR](100) NULL
          )
      END
    `);

    await runQuery("Create tempKitchen table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempKitchen]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempKitchen](
              [KitchenTypeId] [UNIQUEIDENTIFIER] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [KitchenTypeCode] [NUMERIC](18, 2) NOT NULL,
              [KitchenTypeName] [VARCHAR](100) NOT NULL,
              [isActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tempModifierMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempModifierMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempModifierMaster](
              [ModifierID] [UNIQUEIDENTIFIER] NOT NULL,
              [ModifierCode] [VARCHAR](20) NOT NULL,
              [ModifierName] [NVARCHAR](50) NULL,
              [ConflictId] [UNIQUEIDENTIFIER] NULL,
              [isActive] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifyBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [SortCode] [INT] NULL,
              [isPriceAffect] [BIT] NULL,
              [isDishPrice] [BIT] NULL,
              [DishCost] [DECIMAL](18, 2) NULL,
              [isOpenModifier] [BIT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create temporderDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[temporderDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[temporderDetail](
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Description] [VARCHAR](500) NOT NULL,
              [Quantity] [DECIMAL](18, 2) NOT NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [AssociatedDishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SeqNo] [NUMERIC](18, 2) NULL,
              [isTakeAway] [BIT] NULL,
              [DishName] [VARCHAR](150) NULL,
              [ActualAmount] [NUMERIC](18, 2) NULL,
              [Tax] [NUMERIC](18, 4) NULL,
              [ServiceCharge] [NUMERIC](18, 4) NULL,
              [PFlag] [CHAR](1) NULL,
              [ModifierDescription] [VARCHAR](300) NULL,
              [Remarks] [VARCHAR](300) NULL
          )
      END
    `);

    await runQuery("Create temppay table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[temppay]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[temppay](
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [PayAmt] [DECIMAL](38, 2) NULL,
              [SetAmt] [MONEY] NULL
          )
      END
    `);

    await runQuery("Create tempPaymentdetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempPaymentdetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempPaymentdetail](
              [PaymentId] [UNIQUEIDENTIFIER] NOT NULL,
              [BilledFor] [INT] NULL,
              [QuoteId] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NULL,
              [InvoiceId] [UNIQUEIDENTIFIER] NULL,
              [DoorDeliveryOrderId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NULL,
              [PaymentCollectedOn] [DATETIME] NOT NULL,
              [PaymentType] [INT] NOT NULL,
              [Paymode] [INT] NOT NULL,
              [Amount] [DECIMAL](18, 2) NOT NULL,
              [ReferenceNumber] [VARCHAR](20) NULL,
              [Remarks] [VARCHAR](150) NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [isSettlement] [BIT] NULL,
              [ReturnAmt] [NUMERIC](10, 2) NULL,
              [PayAmount] [NUMERIC](10, 2) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL,
              [PaymodeServiceChargeAmount] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL
          )
      END
    `);

    await runQuery("Create tempPaymode table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempPaymode]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempPaymode](
              [Position] [DECIMAL](18, 2) NOT NULL,
              [PayMode] [CHAR](10) NOT NULL,
              [Description] [VARCHAR](50) NOT NULL,
              [Commission] [DECIMAL](18, 2) NULL,
              [Active] [BIT] NOT NULL,
              [ImageId] [UNIQUEIDENTIFIER] NULL,
              [CreateUser] [UNIQUEIDENTIFIER] NULL,
              [CreateDate] [SMALLDATETIME] NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [SMALLDATETIME] NULL
          )
      END
    `);

    await runQuery("Create tempPOSFunctions table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempPOSFunctions]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempPOSFunctions](
              [FunctionId] [UNIQUEIDENTIFIER] NULL,
              [FunctionCode] [VARCHAR](10) NOT NULL,
              [FunctionDescription] [VARCHAR](150) NULL,
              [FunctionGroup] [VARCHAR](20) NULL,
              [SortCode] [INT] NULL
          )
      END
    `);

    await runQuery("Create tempPOSPermission table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempPOSPermission]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempPOSPermission](
              [CashierID] [UNIQUEIDENTIFIER] NOT NULL,
              [FunctionId] [UNIQUEIDENTIFIER] NOT NULL,
              [Status] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [SMALLDATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [SMALLDATETIME] NULL
          )
      END
    `);

    await runQuery("Create tempPriceListMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempPriceListMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempPriceListMaster](
              [PriceListId] [UNIQUEIDENTIFIER] NOT NULL,
              [Name] [VARCHAR](100) NOT NULL,
              [Description] [VARCHAR](100) NULL,
              [BeginDate] [DATETIME] NULL,
              [EndDate] [DATETIME] NULL,
              [IsActive] [BIT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [BusinessunitId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create tempPrintMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempPrintMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempPrintMaster](
              [PrinterId] [UNIQUEIDENTIFIER] NOT NULL,
              [PrinterName] [VARCHAR](50) NOT NULL,
              [PrinterPath] [VARCHAR](100) NOT NULL,
              [PrinterIP] [VARCHAR](50) NOT NULL,
              [PrinterType] [INT] NULL,
              [PrintSection] [INT] NULL,
              [KitchenTypeName] [VARCHAR](50) NULL,
              [KitchenTypeValue] [INT] NULL,
              [IsActive] [BIT] NULL,
              [PrintCopy] [INT] NULL
          )
      END
    `);

    await runQuery("Create tempQueryTable table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempQueryTable]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempQueryTable](
              [BusinessunitId] [UNIQUEIDENTIFIER] NOT NULL,
              [QueryDate] [DATETIME] NOT NULL,
              [QueryString] [NTEXT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [IsExec] [BIT] NULL,
              [IsHQFlag] [BIT] NULL
          )
      END
    `);

    await runQuery("Create tempreport table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempreport]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempreport](
              [ReportName] [VARCHAR](300) NULL
          )
      END
    `);

    await runQuery("Create tempRestaurantInvoice table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempRestaurantInvoice]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempRestaurantInvoice](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [RestaurantBillId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [BillNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [TimeBilled] [DATETIME] NULL,
              [PaymentTermCode] [INT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [tips] [MONEY] NULL,
              [InvoiceDate] [SMALLDATETIME] NULL,
              [MergeCount] [NUMERIC](18, 2) NULL,
              [SplitCount] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL
          )
      END
    `);

    await runQuery("Create tempRestaurantOrder table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempRestaurantOrder]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempRestaurantOrder](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [OrderEntryUnit] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [Tableno] [CHAR](10) NULL,
              [Persons] [NUMERIC](18, 2) NULL,
              [TimeBilled] [DATETIME] NULL,
              [PriceListId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [DailyOrderSequenceNumber] [INT] NULL,
              [InformedKitchen] [BIT] NULL,
              [IsTakeAway] [BIT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [PriorityCode] [INT] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [isOrderClosed] [BIT] NOT NULL,
              [isCourse1Fired] [BIT] NULL,
              [isCourse2Fired] [BIT] NULL,
              [isMainCourseFired] [BIT] NULL,
              [isDessertsFired] [BIT] NULL,
              [isGuestMeal] [BIT] NULL,
              [isUploadHQ] [BIT] NULL
          )
      END
    `);

    await runQuery("Create tempRestaurantOrderDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempRestaurantOrderDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempRestaurantOrderDetail](
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Description] [NVARCHAR](500) NOT NULL,
              [Quantity] [DECIMAL](18, 2) NOT NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [AssociatedDishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SeqNo] [NUMERIC](18, 2) NULL,
              [isTakeAway] [BIT] NULL,
              [DishName] [NVARCHAR](150) NULL,
              [ActualAmount] [NUMERIC](18, 2) NULL,
              [Tax] [NUMERIC](18, 4) NULL,
              [ServiceCharge] [NUMERIC](18, 4) NULL,
              [PFlag] [CHAR](1) NULL,
              [ModifierDescription] [NVARCHAR](300) NULL,
              [Remarks] [VARCHAR](300) NULL,
              [ExFlag] [CHAR](1) NULL,
              [IsODFOC] [INT] NULL,
              [IsODItemDiscount] [INT] NULL,
              [isstandardMenu] [BIT] NULL,
              [Pcs] [NUMERIC](18, 2) NULL
          )
      END
    `);

    await runQuery("Create tempRestaurantSplitOrder table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempRestaurantSplitOrder]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempRestaurantSplitOrder](
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [ParentOrderId] [UNIQUEIDENTIFIER] NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderNumber] [VARCHAR](20) NOT NULL,
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NOT NULL,
              [Tableno] [CHAR](10) NULL,
              [Persons] [NUMERIC](18, 2) NULL,
              [TimeBilled] [DATETIME] NULL,
              [PriceListId] [UNIQUEIDENTIFIER] NULL,
              [Description] [VARCHAR](100) NULL,
              [DailyOrderSequenceNumber] [INT] NULL,
              [InformedKitchen] [BIT] NULL,
              [IsTakeAway] [BIT] NULL,
              [TotalLineItemAmount] [DECIMAL](18, 2) NULL,
              [TotalLineItemDiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountAmount] [DECIMAL](18, 2) NULL,
              [DiscountPercentage] [DECIMAL](18, 2) NULL,
              [TotalDiscountAmount] [DECIMAL](18, 2) NULL,
              [FreightAmount] [DECIMAL](18, 2) NULL,
              [TotalAmountLessFreight] [DECIMAL](18, 2) NULL,
              [TotalTax] [DECIMAL](18, 2) NULL,
              [RoundedBy] [DECIMAL](18, 2) NULL,
              [TotalAmount] [DECIMAL](18, 2) NULL,
              [PriorityCode] [INT] NULL,
              [StatusCode] [INT] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [ServiceCharge] [NUMERIC](10, 2) NULL,
              [isOrderClosed] [BIT] NOT NULL DEFAULT ((0)),
              [isCourse1Fired] [BIT] NULL DEFAULT ((0)),
              [isCourse2Fired] [BIT] NULL DEFAULT ((0)),
              [isMainCourseFired] [BIT] NULL DEFAULT ((0)),
              [isDessertsFired] [BIT] NULL DEFAULT ((0))
          )
      END
    `);

    await runQuery("Create tempRestaurantSplitOrderDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempRestaurantSplitOrderDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempRestaurantSplitOrderDetail](
              [OrderDetailId] [UNIQUEIDENTIFIER] NOT NULL,
              [OrderId] [UNIQUEIDENTIFIER] NOT NULL,
              [DishId] [UNIQUEIDENTIFIER] NOT NULL,
              [Description] [VARCHAR](500) NOT NULL,
              [Quantity] [DECIMAL](18, 2) NOT NULL,
              [PricePerUnit] [DECIMAL](18, 2) NOT NULL,
              [BaseAmount] [DECIMAL](18, 2) NULL,
              [ManualDiscountAmount] [DECIMAL](18, 2) NULL,
              [TotalDetailLineAmount] [DECIMAL](18, 2) NULL,
              [AssociatedDishId] [UNIQUEIDENTIFIER] NULL,
              [OrderDateTime] [DATETIME] NULL,
              [StatusCode] [INT] NOT NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SeqNo] [NUMERIC](18, 2) NULL DEFAULT ((0)),
              [isTakeAway] [BIT] NULL DEFAULT ((0)),
              [DishName] [VARCHAR](150) NULL DEFAULT (''),
              [ActualAmount] [MONEY] NULL DEFAULT ((0)),
              [Tax] [MONEY] NULL DEFAULT ((0)),
              [ServiceCharge] [MONEY] NULL DEFAULT ((0)),
              [PFlag] [CHAR](1) NULL DEFAULT (''),
              [ModifierDescription] [VARCHAR](300) NULL
          )
      END
    `);

    await runQuery("Create tempRewardPointdetails table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempRewardPointdetails]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempRewardPointdetails](
              [Id] [UNIQUEIDENTIFIER] NOT NULL,
              [Denomination] [DECIMAL](18, 2) NULL,
              [PointsUsage] [DECIMAL](18, 2) NULL,
              [FromDate] [SMALLDATETIME] NULL,
              [ToDate] [SMALLDATETIME] NULL,
              [CreateUser] [UNIQUEIDENTIFIER] NULL,
              [CreateDate] [SMALLDATETIME] NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [SMALLDATETIME] NULL,
              [Amount] [DECIMAL](18, 2) NULL,
              [Discount] [DECIMAL](18, 2) NULL,
              [DefaultDisc] [DECIMAL](18, 2) NULL,
              [DefaultPoint] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create tempSettlementCreditSales table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempSettlementCreditSales]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempSettlementCreditSales](
              [SettlementID] [UNIQUEIDENTIFIER] NOT NULL,
              [PayMode] [VARCHAR](20) NOT NULL,
              [SysAmount] [MONEY] NOT NULL,
              [ManualAmount] [MONEY] NOT NULL,
              [AmountDiff] [MONEY] NOT NULL
          )
      END
    `);

    await runQuery("Create tempSettlementDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempSettlementDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempSettlementDetail](
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [Paymode] [VARCHAR](50) NULL,
              [SysAmount] [MONEY] NULL,
              [ManualAmount] [MONEY] NULL,
              [SortageOrExces] [MONEY] NULL
          )
      END
    `);

    await runQuery("Create tempSettlementHeader table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempSettlementHeader]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempSettlementHeader](
              [SettlementID] [UNIQUEIDENTIFIER] NULL,
              [CashierID] [UNIQUEIDENTIFIER] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [Shift] [NUMERIC](18, 2) NULL,
              [TerminalCode] [VARCHAR](50) NULL,
              [LastSettlementDate] [DATETIME] NULL,
              [SysAmount] [MONEY] NULL,
              [ManualAmount] [MONEY] NULL,
              [SortageOrExces] [MONEY] NULL,
              [isDayEnd] [BIT] NULL,
              [LastDayEndDate] [DATETIME] NULL,
              [CashIn] [MONEY] NULL,
              [CashOut] [MONEY] NULL,
              [TotalTax] [MONEY] NULL,
              [ServiceCharge] [MONEY] NULL,
              [DiscountAmount] [MONEY] NULL,
              [SubTotal] [MONEY] NULL,
              [RoundedBy] [MONEY] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifyOn] [DATETIME] NULL,
              [TotalPax] [NUMERIC](18, 2) NULL,
              [Tips] [MONEY] NULL,
              [VoidAmount] [MONEY] NULL,
              [InvoiceCount] [NUMERIC](8, 2) NULL,
              [CrAmount] [MONEY] NULL,
              [VoidItemQty] [NUMERIC](8, 2) NULL,
              [VoidItemAmount] [MONEY] NULL,
              [ExItemQty] [NUMERIC](18, 2) NULL,
              [ExItemAmount] [MONEY] NULL,
              [DisItemAmount] [MONEY] NULL,
              [PaymodeServiceCharge] [NUMERIC](18, 2) NULL,
              [isUploadHQ] [BIT] NULL,
              [RefundQty] [NUMERIC](18, 2) NULL,
              [RefundAmount] [NUMERIC](18, 4) NULL
          )
      END
    `);

    await runQuery("Create tempSettlementTotalSales table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempSettlementTotalSales]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempSettlementTotalSales](
              [SettlementID] [UNIQUEIDENTIFIER] NOT NULL,
              [PayMode] [VARCHAR](20) NOT NULL,
              [SysAmount] [MONEY] NOT NULL,
              [ManualAmount] [MONEY] NOT NULL,
              [AmountDiff] [MONEY] NOT NULL
          )
      END
    `);

    await runQuery("Create tempSettlementTranDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempSettlementTranDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempSettlementTranDetail](
              [SettlementID] [UNIQUEIDENTIFIER] NOT NULL,
              [PayMode] [VARCHAR](20) NOT NULL,
              [CashIn] [NUMERIC](18, 2) NOT NULL,
              [CashOut] [NUMERIC](18, 2) NOT NULL
          )
      END
    `);

    await runQuery("Create tempTableMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempTableMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempTableMaster](
              [TableId] [UNIQUEIDENTIFIER] NOT NULL,
              [TableNumber] [VARCHAR](10) NOT NULL,
              [Seats] [NUMERIC](18, 2) NOT NULL,
              [ReservationAllowed] [BIT] NOT NULL,
              [DiningSection] [VARCHAR](10) NULL,
              [StartTime] [VARCHAR](50) NULL,
              [EndTime] [VARCHAR](50) NULL,
              [SortCode] [NUMERIC](5, 2) NULL,
              [Row] [INT] NULL,
              [Col] [INT] NULL,
              [PrintSection] [INT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [Status] [BIT] NULL,
              [Terminal] [VARCHAR](10) NULL,
              [LoginUser] [VARCHAR](10) NULL,
              [IstakeAway] [BIT] NULL,
              [TableType] [VARCHAR](20) NULL,
              [XSize] [INT] NULL,
              [YSize] [INT] NULL,
              [XPos] [INT] NULL,
              [YPos] [INT] NULL,
              [Remarks] [VARCHAR](100) NULL,
              [TableLayoutBG] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create tempTransactionMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempTransactionMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempTransactionMaster](
              [TransactionId] [UNIQUEIDENTIFIER] NOT NULL,
              [TransactionNumber] [VARCHAR](20) NOT NULL,
              [TransactionDate] [DATETIME] NOT NULL,
              [TransactionType] [VARCHAR](20) NOT NULL,
              [TransactionMode] [VARCHAR](20) NOT NULL,
              [Amount] [MONEY] NOT NULL,
              [Remarks] [VARCHAR](50) NULL,
              [isSettlement] [BIT] NOT NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL,
              [isUploadHQ] [BIT] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create tempUserGroupMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempUserGroupMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempUserGroupMaster](
              [UserGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [UserGroupCode] [VARCHAR](20) NOT NULL,
              [UserGroupName] [VARCHAR](50) NULL,
              [isActive] [BIT] NOT NULL,
              [CreatedUser] [UNIQUEIDENTIFIER] NULL,
              [Createddate] [DATETIME] NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create tempUsermaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempUsermaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempUsermaster](
              [UserId] [UNIQUEIDENTIFIER] NOT NULL,
              [UserCode] [VARCHAR](20) NOT NULL,
              [UserName] [VARCHAR](20) NOT NULL,
              [UserPassword] [VARCHAR](20) NOT NULL,
              [UserGroupid] [UNIQUEIDENTIFIER] NULL,
              [Salutation] [VARCHAR](20) NULL,
              [FirstName] [VARCHAR](50) NULL,
              [LastName] [VARCHAR](50) NULL,
              [FullName] [VARCHAR](160) NULL,
              [NickName] [VARCHAR](50) NULL,
              [IdentificationNo] [VARCHAR](50) NULL,
              [IsDisabled] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [CardNumber] [VARCHAR](50) NULL
          )
      END
    `);

    await runQuery("Create tempUserPermission table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tempUserPermission]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[tempUserPermission](
              [UserGroupCode] [VARCHAR](20) NULL,
              [FormCode] [CHAR](6) NOT NULL,
              [AllowAdd] [CHAR](1) NOT NULL,
              [AllowUpdate] [CHAR](1) NOT NULL,
              [AllowDelete] [CHAR](1) NOT NULL,
              [AllowRead] [CHAR](1) NOT NULL,
              [CreateUser] [UNIQUEIDENTIFIER] NULL,
              [CreateDate] [SMALLDATETIME] NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [SMALLDATETIME] NULL
          )
      END
    `);

    await runQuery("Create TerminalDenomination table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TerminalDenomination]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TerminalDenomination](
              [CashierId] [UNIQUEIDENTIFIER] NULL,
              [TerminalCode] [CHAR](20) NULL,
              [PostingDate] [DATETIME] NULL,
              [CurrencyValue] [DECIMAL](18, 2) NULL,
              [Qty] [DECIMAL](18, 2) NULL,
              [shift] [INT] NULL,
              [isSettlement] [BIT] NULL DEFAULT ((0)),
              [isDayend] [BIT] NULL DEFAULT ((0)),
              [SettlementId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create TerminalMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TerminalMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TerminalMaster](
              [TerminalId] [UNIQUEIDENTIFIER] NOT NULL,
              [TerminalCode] [CHAR](10) NOT NULL,
              [TerminalName] [VARCHAR](50) NOT NULL,
              [LocationCode] [CHAR](10) NULL,
              [ComputerName] [CHAR](50) NOT NULL,
              [TillAmount] [DECIMAL](18, 2) NULL,
              [PrinterRequired] [BIT] NULL,
              [CashDrawerInterface] [BIT] NULL,
              [DrawerPortNo] [CHAR](10) NULL,
              [isCustDisplayAttached] [BIT] NULL,
              [CreateUser] [UNIQUEIDENTIFIER] NOT NULL,
              [CreateDate] [SMALLDATETIME] NOT NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [SMALLDATETIME] NULL,
              [IdleTime] [INT] NULL,
              [TerminalType] [VARCHAR](10) NULL DEFAULT (''),
              [DisplayPort] [VARCHAR](5) NULL DEFAULT (''),
              [ImagePath] [VARCHAR](100) NULL,
              [isShowCompTotal] [BIT] NULL DEFAULT ((0)),
              [PrintType] [CHAR](20) NULL,
              [OtherLangType] [BIT] NULL,
              [OtherLanguage] [VARCHAR](20) NULL,
              [isSecondDisplayAttached] [BIT] NULL DEFAULT ((0)),
              [SecondDisplayPort] [VARCHAR](10) NULL,
              [MallTerminalId] [VARCHAR](20) NULL,
              [isCameraAttached] [BIT] NULL,
              [CameraPort] [VARCHAR](10) NULL,
              [DisplayType] [VARCHAR](50) NULL,
              [TerminalGroup] [VARCHAR](20) NULL,
              [KitchenTypeValue] [INT] NULL DEFAULT ((0)),
              [isSettlementprint] [BIT] NULL DEFAULT ((0)),
              [isDayendPrint] [BIT] NULL DEFAULT ((0)),
              [NetsAuto] [BIT] NULL DEFAULT ((0)),
              [AutoCash] [BIT] NULL DEFAULT ((0)),
              [isVoiceEnabled] [BIT] NULL DEFAULT ((0)),
              [NetsPort] [VARCHAR](50) NULL,
              [CashMachineHost] [VARCHAR](50) NULL,
              [CashMachinePort] [VARCHAR](50) NULL,
              [Template] [CHAR](1) NULL,
              [NETSSeqNo] [INT] NULL,
              [TimerIntervalOrder] [NUMERIC](10, 2) NULL,
              [TimerIntervalPayment] [NUMERIC](10, 2) NULL
          )
      END
    `);

    await runQuery("Create TimeEntry table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TimeEntry]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TimeEntry](
              [Userid] [UNIQUEIDENTIFIER] NULL,
              [ClockinTime] [DATETIME] NULL,
              [status] [INT] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create TransactionMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TransactionMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TransactionMaster](
              [TransactionId] [UNIQUEIDENTIFIER] NOT NULL,
              [TransactionNumber] [VARCHAR](20) NOT NULL,
              [TransactionDate] [DATETIME] NOT NULL,
              [TransactionType] [VARCHAR](20) NOT NULL,
              [TransactionMode] [VARCHAR](20) NOT NULL,
              [Amount] [MONEY] NOT NULL,
              [Remarks] [VARCHAR](50) NULL,
              [isSettlement] [BIT] NOT NULL,
              [TerminalCode] [VARCHAR](20) NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [SettlementId] [UNIQUEIDENTIFIER] NULL,
              [isDayEnd] [BIT] NULL DEFAULT ((0)),
              [isUploadHQ] [BIT] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL
          )
      END
    `);

    await runQuery("Create TvTakeAway table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TvTakeAway]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[TvTakeAway](
              [Id] [INT] NOT NULL,
              [OrderNo] [VARCHAR](50) NULL,
              [Dish] [VARCHAR](50) NULL,
              [Status] [VARCHAR](30) NULL,
              [Show] [VARCHAR](1) NULL DEFAULT ('N'),
              [CreatedBy] [VARCHAR](50) NULL,
              [CreatedOn] [DATETIME] NULL DEFAULT (getdate()),
              [ModifedBy] [VARCHAR](50) NULL,
              [ModifiedOn] [DATETIME] NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create UserGroupMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserGroupMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[UserGroupMaster](
              [UserGroupId] [UNIQUEIDENTIFIER] NOT NULL,
              [UserGroupCode] [VARCHAR](20) NOT NULL,
              [UserGroupName] [VARCHAR](50) NULL,
              [isActive] [BIT] NOT NULL,
              [CreatedUser] [UNIQUEIDENTIFIER] NULL,
              [Createddate] [DATETIME] NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create UserMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[UserMaster](
              [UserId] [UNIQUEIDENTIFIER] NOT NULL,
              [UserCode] [VARCHAR](20) NOT NULL,
              [UserName] [VARCHAR](20) NOT NULL,
              [UserPassword] [VARCHAR](20) NOT NULL,
              [UserGroupid] [UNIQUEIDENTIFIER] NULL,
              [Salutation] [VARCHAR](20) NULL,
              [FirstName] [VARCHAR](50) NULL,
              [LastName] [VARCHAR](50) NULL,
              [FullName] [VARCHAR](160) NULL,
              [NickName] [VARCHAR](50) NULL,
              [IdentificationNo] [VARCHAR](50) NULL,
              [IsDisabled] [BIT] NULL DEFAULT ((0)),
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [CardNumber] [VARCHAR](50) NULL,
              [isWaiter] [BIT] NULL,
              [DailyVoidLimit] [DECIMAL](18, 2) NULL,
              [DailyCancelLimit] [DECIMAL](18, 2) NULL,
              [LastLogInDate] [DATETIME] NULL,
              [CurrentVoidAmount] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [CurrentCancelAmount] [DECIMAL](18, 2) NULL DEFAULT ((0)),
              [FromDate] [DATE] NULL,
              [ToDate] [DATE] NULL
          )
      END
    `);

    await runQuery("Create UserPermission table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserPermission]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[UserPermission](
              [UserGroupCode] [VARCHAR](20) NULL,
              [FormCode] [CHAR](6) NOT NULL,
              [AllowAdd] [CHAR](1) NOT NULL,
              [AllowUpdate] [CHAR](1) NOT NULL,
              [AllowDelete] [CHAR](1) NOT NULL,
              [AllowRead] [CHAR](1) NULL,
              [CreateUser] [UNIQUEIDENTIFIER] NULL,
              [CreateDate] [SMALLDATETIME] NULL,
              [ModifyUser] [UNIQUEIDENTIFIER] NULL,
              [ModifyDate] [SMALLDATETIME] NULL
          )
      END
    `);

    await runQuery("Create ValueCardDetail table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ValueCardDetail]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[ValueCardDetail](
              [CustomerId] [UNIQUEIDENTIFIER] NULL,
              [CardNo] [VARCHAR](20) NULL,
              [PackagePrice] [MONEY] NULL,
              [PaidAmount] [MONEY] NULL,
              [Serviccevalue] [MONEY] NULL,
              [PaymentId] [UNIQUEIDENTIFIER] NULL,
              [PaymentDate] [DATETIME] NULL,
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [Terminal] [VARCHAR](10) NULL,
              [isTopup] [BIT] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NULL,
              [CreatedOn] [DATETIME] NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [CurBalance] [MONEY] NULL,
              [ServiceValue] [MONEY] NULL
          )
      END
    `);

    await runQuery("Create VendorMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[VendorMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[VendorMaster](
              [VendorId] [UNIQUEIDENTIFIER] NOT NULL,
              [VendorCode] [VARCHAR](20) NOT NULL,
              [Name] [VARCHAR](160) NOT NULL,
              [ContactPerson] [VARCHAR](100) NOT NULL,
              [EmailId1] [VARCHAR](100) NULL,
              [EmailId2] [VARCHAR](100) NULL,
              [WebSite] [VARCHAR](200) NULL,
              [Address1_Name] [VARCHAR](200) NULL,
              [Address1_Id] [UNIQUEIDENTIFIER] NULL,
              [Address1_TypeCode] [INT] NOT NULL,
              [Address1_PrimaryContactName] [VARCHAR](150) NULL,
              [Address1_Line1] [VARCHAR](50) NOT NULL,
              [Address1_Line2] [VARCHAR](50) NULL,
              [Address1_Line3] [VARCHAR](50) NULL,
              [Address1_City] [VARCHAR](50) NULL,
              [Address1_State] [VARCHAR](50) NULL,
              [Address1_Country] [VARCHAR](50) NULL,
              [Address1_PostalCode] [VARCHAR](20) NULL,
              [Address1_Telephone1] [VARCHAR](20) NOT NULL,
              [Address1_Telephone2] [VARCHAR](20) NULL,
              [Address1_Fax] [VARCHAR](20) NULL,
              [Address1_FreightTermCode] [INT] NULL,
              [Address1_ShippingMethodCode] [INT] NULL,
              [PaymentTermsCode] [INT] NULL,
              [CreditLimit] [DECIMAL](18, 2) NULL,
              [StatusCode] [INT] NOT NULL,
              [OwnerBusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL,
              [GstType] [CHAR](1) NULL,
              [GSTPercentage] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create VIPDiscountRule table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[VIPDiscountRule]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[VIPDiscountRule](
              [VIPRuleID] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [RuleName] [NVARCHAR](100) NOT NULL,
              [DishID] [UNIQUEIDENTIFIER] NULL,
              [DishGroupID] [UNIQUEIDENTIFIER] NULL,
              [DiscountType] [VARCHAR](20) NOT NULL,
              [DiscountValue] [DECIMAL](18, 2) NOT NULL,
              [Priority] [INT] NOT NULL DEFAULT ((1)),
              [IsActive] [BIT] NOT NULL DEFAULT ((1)),
              [CreatedDate] [DATETIME] NOT NULL DEFAULT (getdate())
          )
      END
    `);

    await runQuery("Create VoucherMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[VoucherMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[VoucherMaster](
              [VoucherId] [UNIQUEIDENTIFIER] NULL,
              [VoucherCode] [CHAR](20) NOT NULL,
              [VoucherName] [CHAR](50) NOT NULL,
              [VAmount] [DECIMAL](18, 2) NULL,
              [CreateUser] [CHAR](10) NULL,
              [CreateDate] [SMALLDATETIME] NULL,
              [ModifyUser] [CHAR](10) NULL,
              [ModifyDate] [SMALLDATETIME] NULL
          )
      END
    `);

    await runQuery("Create WriteIn_DishMaster table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WriteIn_DishMaster]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[WriteIn_DishMaster](
              [DishId] [UNIQUEIDENTIFIER] NOT NULL DEFAULT (newid()),
              [DishCode] [VARCHAR](20) NOT NULL,
              [Name] [VARCHAR](150) NOT NULL,
              [NameInOtherLanguage] [NVARCHAR](150) NULL,
              [Description] [NVARCHAR](150) NULL,
              [CurrentCost] [DECIMAL](18, 2) NULL,
              [SellingPrice] [DECIMAL](18, 2) NULL,
              [IsActive] [BIT] NOT NULL DEFAULT (1),
              [BusinessUnitId] [UNIQUEIDENTIFIER] NULL,
              [CreatedBy] [UNIQUEIDENTIFIER] NOT NULL,
              [CreatedOn] [DATETIME] NOT NULL,
              [ModifiedBy] [UNIQUEIDENTIFIER] NULL,
              [ModifiedOn] [DATETIME] NULL
          )
      END
    `);

    await runQuery("Create YourOrderCartItems table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[YourOrderCartItems]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[YourOrderCartItems](
              [ItemId] [NVARCHAR](128) NOT NULL,
              [CartId] [NVARCHAR](MAX) NULL,
              [Quantity] [INT] NOT NULL,
              [DateCreated] [DATETIME] NOT NULL,
              [ProductId] [INT] NOT NULL,
              [OrderNo] [NVARCHAR](MAX) NULL,
              [OrderConfirmQty] [INT] NOT NULL,
              [MobileNo] [NVARCHAR](50) NULL,
              [Cost] [DECIMAL](18, 2) NULL
          )
      END
    `);

    await runQuery("Create YourOrderCartItemsComp table", `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[YourOrderCartItemsComp]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[YourOrderCartItemsComp](
              [ItemId] [NVARCHAR](128) NOT NULL,
              [CartId] [NVARCHAR](MAX) NULL,
              [Quantity] [INT] NOT NULL,
              [DateCreated] [DATETIME] NOT NULL,
              [ProductId] [INT] NOT NULL,
              [OrderNo] [NVARCHAR](MAX) NULL,
              [OrderConfirmQty] [INT] NOT NULL,
              [MobileNo] [NVARCHAR](50) NULL,
              [Cost] [DECIMAL](18, 2) NULL
          )
      END
    `);

  } catch (err) {
    console.error("❌ DB Initialization Failed:", err.message);
  }
}

async function syncKitchensToPrintMaster(pool) {
  try {
    const kdsCheck = await pool.request().query("SELECT COUNT(*) as cnt FROM PrintMaster WHERE PrinterType = 4 AND IsActive = 1");
    if (kdsCheck.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO PrintMaster (PrinterId, PrinterName, PrinterPath, PrinterIP, PrinterType, PrintSection, KitchenTypeName, KitchenTypeValue, IsActive, PrintCopy)
        VALUES (NEWID(), 'KDS Printer', '', '', 4, 1, 'KDS Printer', 9, 1, 1)
      `);
      console.log("🛠️ Auto-created default KDS Printer in PrintMaster.");
    }
  } catch (err) {
    console.error("❌ Kitchen Sync failed:", err.message);
  }
}

module.exports = { initDB, syncKitchensToPrintMaster };

