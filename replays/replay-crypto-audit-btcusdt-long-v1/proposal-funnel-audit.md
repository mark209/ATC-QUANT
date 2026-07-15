# BTCUSDT Proposal Funnel Audit

Replay: crypto-audit-btcusdt-long-v1
Proposals: 3117

## Stage Funnel
### signal
Entering: 3117
Passing: 3117
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### evidence
Entering: 3117
Passing: 4
Rejected: 3113
Rejected percentage: 99.87%
Top reasons:
- 2739x Maximum drawdown
- 262x Maximum realized volatility
- 112x Data quality
Representative examples:
- 2c3c2439-5ecf-4ec1-84d7-5876ddc348bf at 2017-12-23T00:00:00.000Z: Data quality
- c97bfca5-4bf4-4df1-8cc9-d6bc579c6602 at 2017-12-24T00:00:00.000Z: Data quality
- dc9bd793-b6c6-47a5-83eb-cb8f487533a7 at 2017-12-25T00:00:00.000Z: Data quality

### risk
Entering: 4
Passing: 4
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### expected value
Entering: 4
Passing: 4
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### Kelly
Entering: 4
Passing: 4
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### proposal
Entering: 3117
Passing: 3117
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### order creation
Entering: 3117
Passing: 4
Rejected: 3113
Rejected percentage: 99.87%
Top reasons:
- 2739x Maximum drawdown
- 262x Maximum realized volatility
- 112x Data quality
Representative examples:
- 2c3c2439-5ecf-4ec1-84d7-5876ddc348bf at 2017-12-23T00:00:00.000Z: Data quality
- c97bfca5-4bf4-4df1-8cc9-d6bc579c6602 at 2017-12-24T00:00:00.000Z: Data quality
- dc9bd793-b6c6-47a5-83eb-cb8f487533a7 at 2017-12-25T00:00:00.000Z: Data quality

### execution
Entering: 4
Passing: 4
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### completed trade
Entering: 4
Passing: 4
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

## Waterfall
| Stage | Count | Retained | Reduction |
|---|---:|---:|---:|
| proposals | 3117 | 100.00% | 0 |
| signal | 3117 | 100.00% | 0 |
| evidence | 4 | 0.13% | 3113 |
| risk | 4 | 0.13% | 0 |
| expected value | 4 | 0.13% | 0 |
| Kelly | 4 | 0.13% | 0 |
| proposal | 3117 | 100.00% | -3113 |
| order creation | 4 | 0.13% | 3113 |
| execution | 4 | 0.13% | 0 |
| completed trade | 4 | 0.13% | 0 |

Greatest reduction: **evidence (3113)**

## Trace/Lifecycle Mismatches
Mismatch count: 3117
| Proposal ID | Timestamp | First divergence | Trace | Lifecycle |
|---|---|---|---|---|
| 21cc004c-cded-45e1-8d5d-084beb800dd9 | 2017-10-16T00:00:00.000Z | signal | reject | pass |
| 2c3c2439-5ecf-4ec1-84d7-5876ddc348bf | 2017-12-23T00:00:00.000Z | proposal | reject | pass |
| c97bfca5-4bf4-4df1-8cc9-d6bc579c6602 | 2017-12-24T00:00:00.000Z | proposal | reject | pass |
| dc9bd793-b6c6-47a5-83eb-cb8f487533a7 | 2017-12-25T00:00:00.000Z | proposal | reject | pass |
| 44cfde08-6bf7-4bc3-8e7c-d44722e865aa | 2017-12-26T00:00:00.000Z | proposal | reject | pass |
| c7ee5926-7b90-4b8c-8533-da2801e740ed | 2017-12-27T00:00:00.000Z | evidence | reject | pass |
| 1d180edb-ccca-4ee9-8bb2-74b923388ac2 | 2017-12-29T00:00:00.000Z | proposal | reject | pass |
| e6b38205-482c-41a6-893b-b8843c3bb377 | 2017-12-30T00:00:00.000Z | evidence | reject | pass |
| f3a0d7ba-fdfd-4ebc-88e6-274fd19e3a48 | 2017-12-31T00:00:00.000Z | proposal | reject | pass |
| 3ac8e84a-8882-4bd1-83d3-9b249ef17e6a | 2018-01-01T00:00:00.000Z | proposal | reject | pass |
| 5dd72db3-46e7-456f-81e6-da9f167cf3b1 | 2018-01-02T00:00:00.000Z | proposal | reject | pass |
| 557a9f77-df28-4fcd-8e16-ba5be3f69aca | 2018-01-03T00:00:00.000Z | evidence | reject | pass |
| abd5d01b-6180-448c-8173-218f4bcecac9 | 2018-01-12T00:00:00.000Z | signal | reject | pass |
| c66f2a0a-6e1b-4585-8dfc-c867976ea4f4 | 2018-01-13T00:00:00.000Z | signal | reject | pass |
| 82fb1985-1716-4656-88ad-2001cc1b86f5 | 2018-01-14T00:00:00.000Z | signal | reject | pass |
| e3f2c247-2f0e-4e1f-8631-02f139278230 | 2018-01-15T00:00:00.000Z | signal | reject | pass |
| 2eaf77d5-54f3-4ba9-856d-0cc3db66eca4 | 2018-01-16T00:00:00.000Z | signal | reject | pass |
| 33b7d9a5-d70d-4b29-85cb-1af96f4e4762 | 2018-01-17T00:00:00.000Z | signal | reject | pass |
| dcd3ab3c-406a-41f4-827e-0d86ce676faf | 2018-01-18T00:00:00.000Z | signal | reject | pass |
| 831f37b6-5efc-48da-8396-f25e875993bb | 2018-01-19T00:00:00.000Z | signal | reject | pass |
| 06df4846-6194-4281-8526-5bcd8adc5c9d | 2018-01-20T00:00:00.000Z | signal | reject | pass |
| 699d8224-7933-4b56-8c53-926529b2412d | 2018-01-21T00:00:00.000Z | signal | reject | pass |
| ea5f9fc7-3cba-4783-8709-7cbdea26aa52 | 2018-01-22T00:00:00.000Z | signal | reject | pass |
| 331ed496-8070-4c1b-8f76-af8e7f43b4e8 | 2018-01-23T00:00:00.000Z | signal | reject | pass |
| 21221e69-35de-4039-881e-22d41a5ebcdc | 2018-01-24T00:00:00.000Z | signal | reject | pass |
| 555ce2af-dbd2-445c-8df5-40dd5e0b95d6 | 2018-01-25T00:00:00.000Z | signal | reject | pass |
| bfb5ec0e-d158-4de5-84ac-6e38a30fb7d3 | 2018-01-26T00:00:00.000Z | signal | reject | pass |
| ac81fe07-9b17-460e-891a-5b89b3b6d5e7 | 2018-01-27T00:00:00.000Z | signal | reject | pass |
| cd8d873d-0682-4c76-8ba1-ff8ccfaa6b61 | 2018-01-28T00:00:00.000Z | signal | reject | pass |
| 18b54f24-d5d9-4361-85bf-e83dd32f0553 | 2018-01-29T00:00:00.000Z | signal | reject | pass |
| 3e11db33-c161-42d0-8cc0-f8c12600d493 | 2018-01-30T00:00:00.000Z | signal | reject | pass |
| 964744a8-38a9-4b76-8caf-6a8e88e7cf25 | 2018-01-31T00:00:00.000Z | signal | reject | pass |
| 3762192b-4efb-4e7c-843f-465ca032ac2e | 2018-02-01T00:00:00.000Z | signal | reject | pass |
| 6ca14f0f-6292-4399-80da-670147eafea3 | 2018-02-02T00:00:00.000Z | signal | reject | pass |
| 3b057ac7-a31b-4cf5-89c2-a7450b08009b | 2018-02-03T00:00:00.000Z | signal | reject | pass |
| 091e2d6a-4437-4412-88a4-7b2adfd12ca6 | 2018-02-04T00:00:00.000Z | signal | reject | pass |
| 0954f4df-c9f8-4aa7-8e60-56cffd59a6d8 | 2018-02-05T00:00:00.000Z | signal | reject | pass |
| 113b9f93-a822-4ee9-8342-09aef99b7884 | 2018-02-06T00:00:00.000Z | signal | reject | pass |
| 21a8cb5e-1e2b-4cbc-8b00-cfe3582c1d33 | 2018-02-07T00:00:00.000Z | signal | reject | pass |
| c0092564-6871-4b4d-8501-22610f418d75 | 2018-02-08T00:00:00.000Z | signal | reject | pass |
| f7db2249-7ade-4b65-8bd2-23f86be53664 | 2018-02-09T00:00:00.000Z | signal | reject | pass |
| c3d038c2-6320-41a4-855f-85e03af0416a | 2018-02-10T00:00:00.000Z | signal | reject | pass |
| 92999b87-7400-418c-8894-a4c282167121 | 2018-02-11T00:00:00.000Z | signal | reject | pass |
| 7c8021da-210b-4dfe-80be-c81807dec51d | 2018-02-12T00:00:00.000Z | signal | reject | pass |
| bf59d6de-976a-43a8-8714-0c63639aa8ab | 2018-02-13T00:00:00.000Z | signal | reject | pass |
| 70b9d40d-e3b7-420e-8694-8d3cf9371e5f | 2018-02-14T00:00:00.000Z | signal | reject | pass |
| d6747df9-642b-4691-87ac-06f02bfb47e3 | 2018-02-15T00:00:00.000Z | signal | reject | pass |
| 393e0301-0d1e-4bb9-8b86-b780e9996521 | 2018-02-16T00:00:00.000Z | signal | reject | pass |
| 71a081cf-08ea-4629-8e89-55f088a0eada | 2018-02-17T00:00:00.000Z | signal | reject | pass |
| f89e78d2-87d1-4792-896a-8be61687fd6a | 2018-02-18T00:00:00.000Z | signal | reject | pass |
| 8546d17e-eef8-478d-8cec-37e28a9f2f95 | 2018-02-19T00:00:00.000Z | signal | reject | pass |
| be62c417-32cf-4e3b-8ade-6213f5a1d72c | 2018-02-20T00:00:00.000Z | signal | reject | pass |
| 31326bd0-baf4-43d3-8ab4-9868f2d65cf9 | 2018-02-21T00:00:00.000Z | signal | reject | pass |
| 033ef8ba-24a8-4463-8083-5f1d144f564b | 2018-02-22T00:00:00.000Z | signal | reject | pass |
| 31a3e9ec-6c48-4078-86f2-e11917093cbc | 2018-02-23T00:00:00.000Z | signal | reject | pass |
| fea07e88-0c9b-4dae-80cb-ff220da066de | 2018-02-24T00:00:00.000Z | signal | reject | pass |
| e82d5c8d-dc03-455e-8491-701e0e0dc66a | 2018-02-25T00:00:00.000Z | signal | reject | pass |
| 0b28a984-79d1-4975-8679-8c6399f56e42 | 2018-02-26T00:00:00.000Z | signal | reject | pass |
| 1b5f07fa-84a9-4b0f-8470-f0726dde14f3 | 2018-02-27T00:00:00.000Z | signal | reject | pass |
| ff428967-1227-4eba-8714-59f66522f2cc | 2018-02-28T00:00:00.000Z | signal | reject | pass |
| 1e3a890f-7a03-4a96-80fe-ce0a73153a89 | 2018-03-01T00:00:00.000Z | signal | reject | pass |
| 44168ebe-52d1-4257-8649-fcffdfab6a26 | 2018-03-02T00:00:00.000Z | signal | reject | pass |
| 626f40df-43c2-4bbe-82fc-e21314c7b8bc | 2018-03-03T00:00:00.000Z | signal | reject | pass |
| ea720fc7-543a-41f0-888e-acf544d90084 | 2018-03-04T00:00:00.000Z | signal | reject | pass |
| 0fdd9340-e71a-423d-8e3a-bff240fd5495 | 2018-03-05T00:00:00.000Z | proposal | reject | pass |
| f0098495-89c4-4a27-8099-b68c1dff1d86 | 2018-03-06T00:00:00.000Z | proposal | reject | pass |
| f3c3f9a6-d3ed-40fd-839e-7ddb874aaaab | 2018-03-07T00:00:00.000Z | proposal | reject | pass |
| b50a952a-6d4a-452c-8d13-748ab61e1418 | 2018-03-08T00:00:00.000Z | proposal | reject | pass |
| 0b02a992-de56-43fa-8e24-e6bb2a086e9d | 2018-03-09T00:00:00.000Z | signal | reject | pass |
| 95b96614-0bea-4b47-813c-f52c81a48a88 | 2018-03-10T00:00:00.000Z | signal | reject | pass |
| ea51272d-ad15-4e81-805d-d92430bd8700 | 2018-03-11T00:00:00.000Z | signal | reject | pass |
| c0b6a4fa-3ce3-485c-8114-c11a1a0d6c2f | 2018-03-12T00:00:00.000Z | signal | reject | pass |
| b86566f0-a146-4e4e-82e1-e1df96ccc930 | 2018-03-13T00:00:00.000Z | signal | reject | pass |
| 59274c61-5143-4a6e-845f-eff9bd2276c7 | 2018-03-14T00:00:00.000Z | signal | reject | pass |
| 9fdbbcc1-2d51-428f-835b-b8dd434706d3 | 2018-03-15T00:00:00.000Z | signal | reject | pass |
| f5cbb4fb-eb64-42d3-888d-c128d751cd3f | 2018-03-16T00:00:00.000Z | signal | reject | pass |
| 45bcb939-1276-4726-871a-3407de33323d | 2018-03-17T00:00:00.000Z | signal | reject | pass |
| 9040ba15-af84-4937-8e4b-2c19562d3d85 | 2018-03-18T00:00:00.000Z | signal | reject | pass |
| 6e8515f4-3cca-44e0-8f02-19a5317039c7 | 2018-03-19T00:00:00.000Z | signal | reject | pass |
| 18f7a55c-32a8-4bb2-8c7c-b21e74aff5b6 | 2018-03-20T00:00:00.000Z | signal | reject | pass |
| 70dda0d4-3d9c-4636-8d03-fd2535ef95a4 | 2018-03-21T00:00:00.000Z | signal | reject | pass |
| 901d63bb-9873-4354-8e18-c1cc65ccb6a6 | 2018-03-22T00:00:00.000Z | signal | reject | pass |
| b3b1f472-ab2c-43d4-859a-375f4bd64e48 | 2018-03-23T00:00:00.000Z | signal | reject | pass |
| d7e7de58-34aa-4639-89af-cff978182c54 | 2018-03-24T00:00:00.000Z | signal | reject | pass |
| 4fdcbceb-f915-4a11-8f46-5f2708177bbe | 2018-03-25T00:00:00.000Z | signal | reject | pass |
| 35d9dec1-d2b7-4df3-8835-19f7bbde03d5 | 2018-03-26T00:00:00.000Z | signal | reject | pass |
| 5e17f1c1-0529-4254-8b82-1b451749541f | 2018-03-27T00:00:00.000Z | signal | reject | pass |
| de855950-ee55-4c7c-8d0f-4eba91ea5d33 | 2018-03-28T00:00:00.000Z | signal | reject | pass |
| 0c6e1eb9-8def-421b-8df3-57665f784198 | 2018-03-29T00:00:00.000Z | signal | reject | pass |
| f9b5f66c-36cf-4cdf-8b36-b1400867dcf5 | 2018-03-30T00:00:00.000Z | signal | reject | pass |
| db467fd3-0a05-4bb5-8c1a-08a8aa7960c5 | 2018-03-31T00:00:00.000Z | signal | reject | pass |
| a06bfc73-1944-4f6b-82d8-da3e04c03a21 | 2018-04-01T00:00:00.000Z | signal | reject | pass |
| 9eb68f68-d210-415f-887a-efa542e70225 | 2018-04-02T00:00:00.000Z | signal | reject | pass |
| dcccac6a-7c1e-421e-871c-ea3f5b07d206 | 2018-04-03T00:00:00.000Z | signal | reject | pass |
| 2f604ea6-3c38-4c03-854c-691bf0e50f1e | 2018-04-04T00:00:00.000Z | signal | reject | pass |
| b52becc9-65fb-4013-8ed7-85c5c1f96258 | 2018-04-05T00:00:00.000Z | signal | reject | pass |
| 914a40de-0bcd-45f1-8ecb-12f1562ffe98 | 2018-04-06T00:00:00.000Z | signal | reject | pass |
| 415f38ca-6ef8-4dd4-8e73-26475a0d01b7 | 2018-04-07T00:00:00.000Z | signal | reject | pass |
| 4f9bd40c-2240-4ad2-8e25-ed398d8164df | 2018-04-08T00:00:00.000Z | signal | reject | pass |
| 70a42d28-46cf-4104-8569-e1dd4440e082 | 2018-04-09T00:00:00.000Z | signal | reject | pass |

Lifecycle stages not separately emitted: evidence, expected value, Kelly

## Conclusion
The greatest observed reduction is at evidence (3113 proposals). 3117 of 3117 proposals diverge between trace and lifecycle stage outcomes.
