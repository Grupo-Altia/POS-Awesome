import ast
import json
import pathlib
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
PACKAGE_PATH = REPO_ROOT / "package.json"
MANIFEST_PATH = REPO_ROOT / "posawesome" / "www" / "manifest.json"
WORKSPACE_PATH = (
    REPO_ROOT
    / "posawesome"
    / "posawesome"
    / "workspace"
    / "pos_awesome"
    / "pos_awesome.json"
)
HOOKS_PATH = REPO_ROOT / "posawesome" / "hooks.py"
PATCHES_PATH = REPO_ROOT / "posawesome" / "patches.txt"
REBRAND_PATCH_PATH = (
    REPO_ROOT / "posawesome" / "patches" / "rebrand_retailmind_pos_labels.py"
)
REBRAND_PATCH_MODULE = "posawesome.patches.rebrand_retailmind_pos_labels"


class TestRetailMindBrandingContract(unittest.TestCase):
    def test_desktop_brand_preserves_installed_identity_and_protocol(self):
        package = json.loads(PACKAGE_PATH.read_text())
        build = package["build"]
        protocol = next(
            entry for entry in build["protocols"] if "posawesome" in entry["schemes"]
        )

        self.assertEqual(package["name"], "posawesome")
        self.assertEqual(build["appId"], "com.posawesome.desktop")
        self.assertEqual(build["productName"], "RetailMind-POS Desktop")
        self.assertEqual(protocol["name"], "RetailMind-POS Links")

    def test_pwa_and_workspace_use_new_display_brand(self):
        manifest = json.loads(MANIFEST_PATH.read_text())
        workspace = json.loads(WORKSPACE_PATH.read_text())

        self.assertEqual(manifest["name"], "RetailMind-POS")
        self.assertEqual(manifest["short_name"], "RM-POS")
        self.assertEqual(workspace["name"], "POS Awesome")
        self.assertEqual(workspace["module"], "POSAwesome")
        self.assertEqual(workspace["label"], "RetailMind-POS")
        self.assertEqual(workspace["title"], "RetailMind-POS")

    def test_frappe_app_title_and_existing_site_patch_are_registered(self):
        hooks = HOOKS_PATH.read_text()
        patches = PATCHES_PATH.read_text().splitlines()
        patch_tree = ast.parse(REBRAND_PATCH_PATH.read_text())
        updates_node = next(
            node
            for node in patch_tree.body
            if isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Name) and target.id == "CUSTOM_FIELD_UPDATES"
                for target in node.targets
            )
        )
        updates = ast.literal_eval(updates_node.value)

        self.assertIn('app_name = "posawesome"', hooks)
        self.assertIn('app_title = "RetailMind-POS"', hooks)
        self.assertIn(REBRAND_PATCH_MODULE, patches)
        self.assertEqual(
            updates["POS Profile-posa_section_awesome_dashboard"]["label"],
            "RetailMind Dashboard",
        )
        self.assertEqual(
            updates["POS Settings-posa_enable_awesome_dashboard_global"]["label"],
            "Enable RetailMind Dashboard",
        )


if __name__ == "__main__":
    unittest.main()
