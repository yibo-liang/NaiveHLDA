#include <iostream>
#include <vector>
#include "json.hpp"

using namespace std;

vector<string> parse_args(int argc, char ** argv) {
	vector<string> res;
	for (int i = 0; i < argc; i++) {
		string arg = argv[i];
		res.push_back(arg); 
	}
	return res;
}


int main(int argc, char ** argv) {
	vector<string> args = parse_args(argc, argv);
	string json_model_file = args[0];
	string json_hexmap_file = args[1];

}