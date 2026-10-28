# ORG-Central

Wiki communautaire des ORGs et speeds françaises : saisons, classements, tableaux des votes, awards, inscriptions.

Site statique (un seul `index.html`) + [Supabase](https://supabase.com) pour la base de données, la connexion Discord et les images.

## Mise en ligne

### 1. Base de données (Supabase)
1. Ouvre ton projet Supabase → **SQL Editor** → **New query**.
2. Colle tout le contenu de `supabase/schema.sql`, puis **Run**.

### 2. Connexion Discord
1. Va sur <https://discord.com/developers/applications> → **New Application** → nom « ORG-Central ».
2. Onglet **OAuth2** : copie le **Client ID** et clique **Reset Secret** pour obtenir le **Client Secret**.
3. Dans **Redirects**, ajoute l'adresse donnée par Supabase (Supabase → **Authentication → Providers → Discord**, champ « Callback URL », du type `https://xxxx.supabase.co/auth/v1/callback`).
4. Dans Supabase → **Authentication → Providers → Discord** : active-le, colle le Client ID et le Client Secret, enregistre.

### 3. Configuration du site
Dans `config.js`, remplace les deux valeurs par celles de Supabase → **Project Settings → API** :
- `supabaseUrl` = « Project URL »
- `supabaseAnonKey` = clé « anon public »

(La clé « anon » est faite pour être publique : la sécurité est assurée par les règles de `schema.sql`.)

### 4. Mise en ligne (Vercel)
1. <https://vercel.com> → connexion avec GitHub → **Add New → Project** → choisis ce dépôt → **Deploy** (aucun réglage à changer).
2. Copie l'adresse du site (ex. `https://org-central.vercel.app`) et ajoute-la dans Supabase → **Authentication → URL Configuration** : « Site URL » et « Redirect URLs ».

### 5. Devenir admin et importer les données
1. Ouvre le site, clique **Se connecter avec Discord**.
2. Dans Supabase → SQL Editor, lance :
   `update public.profiles set role = 'admin' where discord_name = 'TON_PSEUDO_DISCORD';`
3. Recharge le site : un bouton **Admin** apparaît. Dans **Admin → Importer des données**, choisis le fichier `org-central-export.json` téléchargé depuis l'ancien site (bouton « Exporter les données » sur son accueil).

## Rôles
- **Admin** : tout, y compris rôles, hosts, validation des « C'est moi ».
- **Host** : crée des joueurs, modifie uniquement les ORGs qui lui sont attribuées (Admin → Comptes et rôles).
- **Joueur** : s'inscrit aux saisons ouvertes, demande à relier sa fiche (« C'est moi »), modifie sa photo, sa bio et ses pronoms une fois reliée.
