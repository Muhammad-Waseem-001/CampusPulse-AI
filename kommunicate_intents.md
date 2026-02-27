# Kommunicate Intents, Entities, and Parameters (Student Helpdesk + Mentor Directory)

Use this setup in Kommunicate Bot Builder for campus student support.

## Intent 1: `welcome_student`
- Purpose: greet student and explain what the bot can do.
- Training phrases:
  - hi
  - hello
  - hey
  - start
  - help
- Entities: none
- Parameters: none
- Bot action:
  - Sends dynamic welcome and suggests course, mentor, and support-query examples.

## Intent 2: `course_info`
- Purpose: answer course-related questions.
- Training phrases:
  - What is the exam format for WEB_DEV?
  - Tell me office hours for GEN_CHATBOT
  - SHOPIFY assignment policy
  - MODERN_WEB_APP schedule
- Entities:
  - `course_code` (custom list): `WEB_DEV`, `GEN_CHATBOT`, `SHOPIFY`, `MODERN_WEB_APP`
- Parameters:
  - `course_code` (required)
- Bot action:
  - Returns office hours, assignment policy, and exam format for selected course.

## Intent 3: `mentor_info`
- Purpose: provide teachers/mentors details.
- Training phrases:
  - Who are the mentors?
  - List all teachers
  - Tell me about Areeba Khan
  - Hamza Siddiqui office hours
  - Shopify mentor contact
- Entities:
  - `mentor_name` (custom list): `AREEBA_KHAN`, `HAMZA_SIDDIQUI`, `MAHNOOR_AHMED`, `ZAIN_ALI`
- Parameters:
  - `mentor_name` (optional)
- Bot action:
  - If no mentor name is provided, returns mentor directory list.
  - If mentor name is provided, returns profile (role, expertise, office hours, contact).

## Intent 4: `submit_student_query`
- Purpose: collect unresolved student issues.
- Training phrases:
  - I have an issue in WEB_DEV assignment
  - I want to submit a complaint
  - I need support for GEN_CHATBOT
  - Raise query for SHOPIFY
- Entities:
  - `student_name` (free text)
  - `student_email` (email)
  - `course_code` (list)
  - `query_text` (long text)
- Parameters:
  - `student_name` (required)
  - `student_email` (required)
  - `course_code` (required)
  - `query_text` (required)
- Bot action:
  - Collects missing fields and then saves to Supabase + Google Sheets + email workflow.

## Intent 5: `fallback`
- Purpose: recover from unsupported input.
- Entities: none
- Parameters: none
- Response:
  - Ask student to query about course, mentor, or submit support issue.

## Entities Setup (Kommunicate)

### `course_code`
- Values + synonyms:
  - `WEB_DEV`: web development, web dev, website development, full stack
  - `GEN_CHATBOT`: generative and chatbot development, generative ai, gen ai, ai chatbot
  - `SHOPIFY`: shopify e-commerce, ecommerce, online store, shopify store
  - `MODERN_WEB_APP`: modren web and app, modern web and app, web and app

### `mentor_name`
- Values + synonyms:
  - `AREEBA_KHAN`: areeba, areeba khan, web mentor
  - `HAMZA_SIDDIQUI`: hamza, hamza siddiqui, gen ai mentor, chatbot mentor
  - `MAHNOOR_AHMED`: mahnoor, mahnoor ahmed, shopify mentor, ecommerce mentor
  - `ZAIN_ALI`: zain, zain ali, modern web mentor, app mentor

### Other free-text entities
- `student_name`
- `student_email`
- `query_text`

## A to Z Kommunicate configuration
1. Create all entities first (`course_code`, `mentor_name`, `student_name`, `student_email`, `query_text`).
2. Create intents: `welcome_student`, `course_info`, `mentor_info`, `submit_student_query`, `fallback`.
3. In `course_info`, add `course_code` as required parameter.
4. In `mentor_info`, add `mentor_name` as optional parameter.
5. In `submit_student_query`, add all 4 required parameters.
6. Enable Dynamic/Webhook response for `course_info`, `mentor_info`, and `submit_student_query`.
7. Set webhook URL to `https://<your-domain-or-ngrok>/webhook`.
8. Train and publish bot.
9. Test:
  - `Who are the mentors?`
  - `Tell me about Hamza Siddiqui`
  - `Exam format of WEB_DEV`
  - `My name is Ali, email ali@test.com, complaint in SHOPIFY checkout`

## Recommended metadata keys
- `student_name`
- `student_email`
- `course_code`
- `query_text`
- `mentor_name`

The backend reads these from payload metadata/parameters and handles dynamic responses.
