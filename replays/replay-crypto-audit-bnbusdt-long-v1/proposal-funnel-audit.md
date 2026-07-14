# BNBUSDT Proposal Funnel Audit

Replay: crypto-audit-bnbusdt-long-v1
Proposals: 3101

## Stage Funnel
### signal
Entering: 3101
Passing: 3101
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### evidence
Entering: 3101
Passing: 3
Rejected: 3098
Rejected percentage: 99.90%
Top reasons:
- 2476x Maximum realized volatility
- 444x Maximum drawdown
- 178x Data quality
Representative examples:
- cc3e1941-9e2c-4bed-8999-6b024c2a779a at 2018-01-17T00:00:00.000Z: Data quality
- bf99e468-24f1-4072-87c3-8271bdf1c215 at 2018-01-18T00:00:00.000Z: Data quality
- b28e0011-d60c-4db0-8634-2909cda16416 at 2018-01-19T00:00:00.000Z: Data quality

### risk
Entering: 3
Passing: 3
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### expected value
Entering: 3
Passing: 3
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### Kelly
Entering: 3
Passing: 3
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### proposal
Entering: 3101
Passing: 3101
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### order creation
Entering: 3101
Passing: 3
Rejected: 3098
Rejected percentage: 99.90%
Top reasons:
- 2476x Maximum realized volatility
- 444x Maximum drawdown
- 178x Data quality
Representative examples:
- cc3e1941-9e2c-4bed-8999-6b024c2a779a at 2018-01-17T00:00:00.000Z: Data quality
- bf99e468-24f1-4072-87c3-8271bdf1c215 at 2018-01-18T00:00:00.000Z: Data quality
- b28e0011-d60c-4db0-8634-2909cda16416 at 2018-01-19T00:00:00.000Z: Data quality

### execution
Entering: 3
Passing: 3
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### completed trade
Entering: 3
Passing: 3
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

## Waterfall
| Stage | Count | Retained | Reduction |
|---|---:|---:|---:|
| proposals | 3101 | 100.00% | 0 |
| signal | 3101 | 100.00% | 0 |
| evidence | 3 | 0.10% | 3098 |
| risk | 3 | 0.10% | 0 |
| expected value | 3 | 0.10% | 0 |
| Kelly | 3 | 0.10% | 0 |
| proposal | 3101 | 100.00% | -3098 |
| order creation | 3 | 0.10% | 3098 |
| execution | 3 | 0.10% | 0 |
| completed trade | 3 | 0.10% | 0 |

Greatest reduction: **evidence (3098)**

## Trace/Lifecycle Mismatches
Mismatch count: 3101
| Proposal ID | Timestamp | First divergence | Trace | Lifecycle |
|---|---|---|---|---|
| 2bb011fd-79d4-4b22-8d6e-7871311b3996 | 2018-01-05T00:00:00.000Z | signal | reject | pass |
| cc3e1941-9e2c-4bed-8999-6b024c2a779a | 2018-01-17T00:00:00.000Z | signal | reject | pass |
| bf99e468-24f1-4072-87c3-8271bdf1c215 | 2018-01-18T00:00:00.000Z | signal | reject | pass |
| b28e0011-d60c-4db0-8634-2909cda16416 | 2018-01-19T00:00:00.000Z | signal | reject | pass |
| ad00b214-dc8f-46f6-83a6-71fc20397610 | 2018-01-20T00:00:00.000Z | signal | reject | pass |
| ce6d4797-13b6-497e-837e-62324ca2bbd1 | 2018-01-21T00:00:00.000Z | signal | reject | pass |
| 977e9b67-8d2f-4b11-8e4b-27d29bec7552 | 2018-01-22T00:00:00.000Z | signal | reject | pass |
| 17d466af-35b5-4100-8f58-a483824d1d24 | 2018-01-23T00:00:00.000Z | signal | reject | pass |
| c741f6a7-b3a1-4de4-8be1-086a2c0c26b5 | 2018-01-24T00:00:00.000Z | signal | reject | pass |
| d125e848-9070-41c9-8f1e-9c3ef3515bd7 | 2018-01-25T00:00:00.000Z | signal | reject | pass |
| ca8e9baf-5523-42f2-8d3f-b1195a765028 | 2018-01-26T00:00:00.000Z | signal | reject | pass |
| 60da271a-748c-470e-8504-dacc5618c712 | 2018-01-27T00:00:00.000Z | signal | reject | pass |
| 96680916-db50-4bf3-8975-465b11e40afd | 2018-01-28T00:00:00.000Z | signal | reject | pass |
| 7e93843f-1203-42b2-8cf0-91062b4c900a | 2018-01-29T00:00:00.000Z | signal | reject | pass |
| fe0fd3a5-9687-467a-86a4-5fc46abc6c72 | 2018-01-30T00:00:00.000Z | signal | reject | pass |
| 34697607-0ac0-4f28-8d61-1401351308f4 | 2018-01-31T00:00:00.000Z | signal | reject | pass |
| 6e8f2257-4580-4d24-89bf-794b25b10887 | 2018-02-01T00:00:00.000Z | signal | reject | pass |
| 1314e20c-b93a-49b4-8463-5ffe251a3843 | 2018-02-02T00:00:00.000Z | signal | reject | pass |
| 62577327-2209-425d-8a83-5a012c9d68ef | 2018-02-03T00:00:00.000Z | signal | reject | pass |
| 423f0f55-81d6-4831-81a4-0fd8cf619a8f | 2018-02-04T00:00:00.000Z | signal | reject | pass |
| ad7a2eef-ec86-4658-87b7-a9c3ff260017 | 2018-02-05T00:00:00.000Z | signal | reject | pass |
| 4ebf0ed4-5c98-4775-8b04-05ff6ea5a189 | 2018-02-06T00:00:00.000Z | signal | reject | pass |
| 16f46a49-f951-4f62-8ee5-24b3cc858085 | 2018-02-07T00:00:00.000Z | signal | reject | pass |
| 6d7ad1ad-7d7c-481d-8e4e-f16b5fbedf5b | 2018-02-08T00:00:00.000Z | signal | reject | pass |
| 8a7888bd-bc87-4fd7-82fe-975d9cc768fd | 2018-02-09T00:00:00.000Z | signal | reject | pass |
| b4e41546-5e9a-4f1c-8c10-58d19d05d659 | 2018-02-10T00:00:00.000Z | signal | reject | pass |
| b60f489e-6c20-40e6-8629-eb4aac7a9d89 | 2018-02-11T00:00:00.000Z | signal | reject | pass |
| 9508f353-bec9-45af-8e9d-b7db4bb387c3 | 2018-02-12T00:00:00.000Z | signal | reject | pass |
| b9480b34-ed6b-4a9f-83b7-297c15b06672 | 2018-02-13T00:00:00.000Z | signal | reject | pass |
| f38fdb1d-cd9b-417f-8d8c-46c8eb90d8f5 | 2018-02-14T00:00:00.000Z | signal | reject | pass |
| 4691cde6-aa4f-43ba-8aff-e939c87e1268 | 2018-02-15T00:00:00.000Z | signal | reject | pass |
| ed458775-d3c0-45f0-8bc6-9b880072980a | 2018-02-16T00:00:00.000Z | signal | reject | pass |
| 87d7d801-4353-4814-8e35-0b056bcad759 | 2018-02-17T00:00:00.000Z | signal | reject | pass |
| 80361236-790d-42be-8faf-1fe9eda57a65 | 2018-02-18T00:00:00.000Z | signal | reject | pass |
| c1478644-c718-4898-83f8-c678bd70a9aa | 2018-02-19T00:00:00.000Z | signal | reject | pass |
| 12441838-1a41-476a-88d4-79a81180d229 | 2018-02-20T00:00:00.000Z | signal | reject | pass |
| 928d8454-a2a6-4de2-8b8d-af45b74c39db | 2018-02-21T00:00:00.000Z | signal | reject | pass |
| 916c0f79-9dda-45dd-83d4-9ad7af2b8f68 | 2018-02-22T00:00:00.000Z | signal | reject | pass |
| c52ce668-9684-49cf-8c3c-1e8900746244 | 2018-02-23T00:00:00.000Z | signal | reject | pass |
| 41114b96-8e9a-4065-832a-ebe45a33ee8b | 2018-02-24T00:00:00.000Z | signal | reject | pass |
| dd05aa32-ae74-4ed4-8b5a-c54f3aabaf14 | 2018-02-25T00:00:00.000Z | signal | reject | pass |
| de1edb45-bd53-41a6-8da5-cb081efdc8c5 | 2018-02-26T00:00:00.000Z | signal | reject | pass |
| 02328035-877e-430a-887d-b1da252ed5a3 | 2018-02-27T00:00:00.000Z | signal | reject | pass |
| 8c03e906-ede3-436c-8c18-1b5bf8287760 | 2018-02-28T00:00:00.000Z | signal | reject | pass |
| c4f15143-febe-45a6-8dbd-f32af73fba2c | 2018-03-01T00:00:00.000Z | signal | reject | pass |
| f7f49080-010d-4743-8d14-309a369f4407 | 2018-03-02T00:00:00.000Z | signal | reject | pass |
| b0f200b6-7c88-46f0-84b8-7d4c3371168b | 2018-03-03T00:00:00.000Z | signal | reject | pass |
| 1af954b3-a190-4ee2-820b-2071d8178362 | 2018-03-04T00:00:00.000Z | signal | reject | pass |
| 71d4ec85-f2ea-442d-89f6-2608f8ca9b3d | 2018-03-05T00:00:00.000Z | signal | reject | pass |
| 09122ec9-c31e-48c6-8c19-7d7c9b7cf8fe | 2018-03-06T00:00:00.000Z | signal | reject | pass |
| 88ce31e5-a9d1-45f0-8e5b-d806ad825613 | 2018-03-07T00:00:00.000Z | signal | reject | pass |
| fdc3f4bf-5ab9-47b0-83b4-fcc8d7195b7a | 2018-03-08T00:00:00.000Z | signal | reject | pass |
| 3c1d63fc-ba5e-46f0-8b85-913693626433 | 2018-03-09T00:00:00.000Z | signal | reject | pass |
| 3de494cc-b989-4245-8cab-40a97091aad8 | 2018-03-10T00:00:00.000Z | signal | reject | pass |
| ff021819-51e1-465f-8bc9-b8a1360d5b9d | 2018-03-11T00:00:00.000Z | signal | reject | pass |
| 4c263a31-39e6-4765-8ed2-56f141fe286e | 2018-03-12T00:00:00.000Z | signal | reject | pass |
| a5dc40fb-d64c-4f3a-8a6d-53b6e1438ec2 | 2018-03-13T00:00:00.000Z | signal | reject | pass |
| 74e3e255-e68c-45c8-8f42-dd843cc4e48a | 2018-03-14T00:00:00.000Z | proposal | reject | pass |
| 9695617b-a725-4d86-8f99-f2a32a7c3059 | 2018-03-15T00:00:00.000Z | signal | reject | pass |
| 0564eacd-32db-49cb-8f64-7bba891ac0af | 2018-03-16T00:00:00.000Z | signal | reject | pass |
| 9e0696cf-232c-4213-87e6-fc01f34989e1 | 2018-03-17T00:00:00.000Z | signal | reject | pass |
| d7ee6937-b7af-4f6f-85dc-7a56d58d5f4a | 2018-03-18T00:00:00.000Z | signal | reject | pass |
| dfe66c40-72f9-4cee-83f8-b06c90b7a302 | 2018-03-19T00:00:00.000Z | signal | reject | pass |
| 2f9c4b31-ee99-4574-8f36-0da7afd9324a | 2018-03-20T00:00:00.000Z | signal | reject | pass |
| 6b32faed-166a-4b53-80be-e6a3a3ba283f | 2018-03-21T00:00:00.000Z | signal | reject | pass |
| c494999c-faa0-442a-8f0e-4b37df7f01db | 2018-03-22T00:00:00.000Z | signal | reject | pass |
| 26f184cd-b4ab-4bd6-89db-98ef063b7167 | 2018-03-23T00:00:00.000Z | signal | reject | pass |
| 11fccf7a-ef72-4bdf-8a84-c42ff90d956e | 2018-03-24T00:00:00.000Z | signal | reject | pass |
| 9cf5d03d-7750-4a64-8da8-8aa085633439 | 2018-03-25T00:00:00.000Z | signal | reject | pass |
| 83461165-6608-4692-8abe-e9d981369d2b | 2018-03-26T00:00:00.000Z | signal | reject | pass |
| a39aac3e-330d-4326-833a-2e1ab37e93a4 | 2018-03-27T00:00:00.000Z | signal | reject | pass |
| 75d9b73b-eb84-4b65-8440-cf822ea97e59 | 2018-03-28T00:00:00.000Z | signal | reject | pass |
| 54c19c33-5ac6-40c6-8397-88df98730baf | 2018-03-29T00:00:00.000Z | signal | reject | pass |
| 8ec2c29d-ecc0-45b5-8540-6f67175e3a9c | 2018-03-30T00:00:00.000Z | signal | reject | pass |
| 51c80a4c-dd9e-4cee-8c5a-2d9e95a58042 | 2018-03-31T00:00:00.000Z | signal | reject | pass |
| 49b2594c-facb-47b7-8c44-4c24499d5564 | 2018-04-01T00:00:00.000Z | signal | reject | pass |
| 27a975a0-1f6c-455c-8afb-5e1c23a870b9 | 2018-04-02T00:00:00.000Z | signal | reject | pass |
| d91c58d0-be35-426e-828c-c8fccebfc929 | 2018-04-03T00:00:00.000Z | signal | reject | pass |
| 72be76f2-7fed-4f94-8c19-0b86c3ee80d0 | 2018-04-04T00:00:00.000Z | signal | reject | pass |
| 61827e77-e90e-406b-8070-e18bd8765255 | 2018-04-05T00:00:00.000Z | signal | reject | pass |
| acfd38de-5488-475f-8f80-093c505c1f71 | 2018-04-06T00:00:00.000Z | signal | reject | pass |
| 438bb034-b401-4709-84ce-7b409bd9afb1 | 2018-04-07T00:00:00.000Z | signal | reject | pass |
| ce52143a-cfc5-4790-809d-1ee199bfcc6e | 2018-04-08T00:00:00.000Z | signal | reject | pass |
| 6e25e22d-e22f-4f5c-8015-359aa29d7ee1 | 2018-04-09T00:00:00.000Z | signal | reject | pass |
| b87b923e-9790-43e9-8fb9-203d2336ba21 | 2018-04-10T00:00:00.000Z | signal | reject | pass |
| 7f8f71a0-0602-46d1-83c6-b6208a026b31 | 2018-04-11T00:00:00.000Z | signal | reject | pass |
| 649c8f92-c16e-405b-8505-b82ce1548582 | 2018-04-12T00:00:00.000Z | signal | reject | pass |
| 7c4b3735-6147-464f-8851-436b790ce0af | 2018-04-13T00:00:00.000Z | signal | reject | pass |
| 02dbf932-2718-4104-8a8a-00e4400df9a3 | 2018-04-14T00:00:00.000Z | signal | reject | pass |
| 58670d83-e6aa-4601-8556-01f05ff8e7d5 | 2018-04-15T00:00:00.000Z | signal | reject | pass |
| cc7b45d2-595d-44ab-8719-8b801db3cfd7 | 2018-04-16T00:00:00.000Z | signal | reject | pass |
| b03aa9da-069c-43e0-8751-1c36b1b536ca | 2018-04-17T00:00:00.000Z | signal | reject | pass |
| d72299c2-399b-495a-8db9-862f6c6513ac | 2018-04-18T00:00:00.000Z | signal | reject | pass |
| 95613199-cbae-46a9-8262-a30115bed2d2 | 2018-04-19T00:00:00.000Z | signal | reject | pass |
| a9caf79f-d2ea-4f01-8b50-b073ea13d7e9 | 2018-04-20T00:00:00.000Z | signal | reject | pass |
| 137e3cd5-01ac-4230-8459-181130157e98 | 2018-04-21T00:00:00.000Z | signal | reject | pass |
| 4547add1-7eca-4ffd-8601-6093dc4511ee | 2018-04-22T00:00:00.000Z | signal | reject | pass |
| f1411afb-2b06-4a63-8ce7-70da621eedbe | 2018-04-23T00:00:00.000Z | signal | reject | pass |
| 9beb01d5-9185-44bb-8e49-9128cf3a0672 | 2018-04-24T00:00:00.000Z | signal | reject | pass |
| 71c05727-2749-4bf2-884e-17966dc7581e | 2018-04-25T00:00:00.000Z | proposal | reject | pass |

Lifecycle stages not separately emitted: evidence, expected value, Kelly

## Conclusion
The greatest observed reduction is at evidence (3098 proposals). 3101 of 3101 proposals diverge between trace and lifecycle stage outcomes.
