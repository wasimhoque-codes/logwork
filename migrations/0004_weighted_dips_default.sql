-- NULL identifies programmes saved before the one-time weighted-dips update.
ALTER TABLE programmes ADD COLUMN weighted_dips_default_applied INTEGER
  CHECK(weighted_dips_default_applied IN (0,1));
